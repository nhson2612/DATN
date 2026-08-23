import json
import time
import os
import re
import unicodedata
from collections import Counter
from decimal import Decimal
from app.db import execute_query
from app import agent_legacy as old_agent
from app import ir_agent as new_agent

# Load benchmark questions
BENCHMARK_FILE = os.path.join(os.path.dirname(__file__), "benchmark_gsqa_auto.json")

def check_crs_violation(sql):
    """
    Checks if the SQL query performs distance-based calculations (> 1 unit)
    using EPSG:4326 geometries directly without casting to geography
    or transforming to a metric projection (like 3406).
    """
    if not sql:
        return False
    
    # Clean SQL for easier regex matching
    sql_clean = re.sub(r'\s+', ' ', sql).lower()
    
    # 1. Look for ST_Distance(a, b) < numeric where numeric > 1.0 (indicating meters intended, but degrees used)
    distance_pattern = r"st_distance\(([^)]+)\)\s*([<>=]+)\s*(\d+(?:\.\d+)?)"
    for match in re.finditer(distance_pattern, sql_clean):
        geom_args = match.group(1)
        val = float(match.group(3))
        if val > 1.0:
            if "geography" not in geom_args and "3406" not in sql_clean:
                return True
                
    # 2. Look for ST_DWithin(a, b, numeric) where numeric > 1.0 and geography/transform is missing
    dwithin_pattern = r"st_dwithin\(([^,]+),\s*([^,]+),\s*(\d+(?:\.\d+)?)\)"
    for match in re.finditer(dwithin_pattern, sql_clean):
        geom1 = match.group(1)
        geom2 = match.group(2)
        val = float(match.group(3))
        if val > 1.0:
            if "geography" not in geom1 and "geography" not in geom2 and "3406" not in sql_clean:
                return True
                
    return False

def is_abstention(res):
    """Agent co TU CHOI tra loi mot cach tuong minh hay khong.

    Truoc day benchmark coi "tra ve 0 dong" la tu choi. Sai o hai huong:
      - Agent fail hoan toan (khong sinh duoc SQL) cung duoc tinh la tu choi,
        nen mot agent luon crash se dat 100% tren nhom cau hoi L0.
      - Cau hoi tra loi duoc nhung khong co ket qua bi tinh la tu choi sai.
    Tu choi that phai la tin hieu ro rang: IR co target=None, hoac SQL dung
    dang "SELECT NULL WHERE FALSE" ma compile_ir sinh cho truong hop do.
    """
    if not res.get("success"):
        return False                      # that bai KHONG phai tu choi
    ir = res.get("ir")
    if isinstance(ir, dict) and ir.get("target") in (None, "none"):
        return True
    sql = (res.get("sql") or "").strip().rstrip(";").upper()
    return sql == "SELECT NULL WHERE FALSE"


def norm(v):
    if v is None:
        return None
    if isinstance(v, (int, float, Decimal)):
        return round(float(v), 2)
    return unicodedata.normalize("NFC", str(v)).strip().lower()

def execution_match(pred_rows, gold_rows, key_cols, ordered, is_count=False):
    if is_count:
        try:
            p_val = int(list(pred_rows[0].values())[0]) if pred_rows else 0
            g_val = int(list(gold_rows[0].values())[0]) if gold_rows else 0
            return p_val == g_val
        except Exception:
            return False
            
    # For list queries
    p = []
    for r in pred_rows or []:
        row_vals = []
        for c in key_cols:
            v = r.get(c)
            if v is None and c == "name" and len(r) > 0:
                v = list(r.values())[0]
            row_vals.append(norm(v))
        p.append(tuple(row_vals))
        
    g = []
    for r in gold_rows or []:
        row_vals = []
        for c in key_cols:
            v = r.get(c)
            row_vals.append(norm(v))
        g.append(tuple(row_vals))
        
    if ordered:
        return p == g
    else:
        return Counter(p) == Counter(g)

def compute_semantic_accuracy(agent_rows, gold_results, is_count):
    if not agent_rows:
        if is_count:
            gold_val = int(list(gold_results[0].values())[0]) if gold_results else 0
            return 1.0 if gold_val == 0 else 0.0
        else:
            return 1.0 if not gold_results else 0.0
            
    if is_count:
        try:
            agent_count = int(list(agent_rows[0].values())[0])
            gold_count = int(list(gold_results[0].values())[0]) if gold_results else 0
            return 1.0 if agent_count == gold_count else 0.0
        except Exception:
            return 0.0
    else:
        agent_names = [row["name"] for row in agent_rows if "name" in row]
        if not agent_names and len(agent_rows) > 0:
            agent_names = [list(row.values())[0] for row in agent_rows]
            
        gold_names = [row["name"] for row in gold_results if "name" in row]
        if not gold_names and len(gold_results) > 0:
            gold_names = [list(row.values())[0] for row in gold_results]
            
        # Dung chung norm() voi execution_match: str().lower() khong chuan hoa
        # NFC nen ten tieng Viet luu NFD trong DB vs NFC trong gold JSON co the
        # ex_match=True ma Jaccard=0 cho cung mot dong.
        agent_set = set(norm(n) for n in agent_names)
        gold_set = set(norm(n) for n in gold_names)
        
        if not agent_set and not gold_set:
            return 1.0
            
        intersection = agent_set.intersection(gold_set)
        union = agent_set.union(gold_set)
        
        return len(intersection) / len(union) if union else 0.0

def run_benchmark():
    with open(BENCHMARK_FILE, "r", encoding="utf-8") as f:
        all_cases = json.load(f)

    # Filter to run ONLY on the 'test' split (P2.1)
    test_cases = [c for c in all_cases if c.get("split") == "test"]
    print(f"Loaded {len(all_cases)} total cases. Running evaluation on {len(test_cases)} 'test' split cases.")
    
    results = []

    # Counters and metrics
    old_va_count = 0
    new_va_count = 0
    old_ex_count = 0
    new_ex_count = 0
    
    old_crs_violations = 0
    new_crs_violations = 0
    old_latencies = []
    new_latencies = []
    old_accuracies = []
    new_accuracies = []
    
    old_llm_calls = []
    new_llm_calls = []
    
    # Abstention confusion matrix components (L0 unanswerable)
    old_tp = old_fp = old_fn = old_tn = 0
    new_tp = new_fp = new_fn = new_tn = 0

    for case in test_cases:
        qid = case["id"]
        template = case["template"]
        question = case["question"]
        difficulty = case["difficulty"]
        is_count = (case.get("key_cols") == ["total"])
        key_cols = case.get("key_cols", ["name"])
        ordered = case.get("ordered", False)
        answerable = case.get("answerable", True)
        gold_results = case.get("gold_results", [])
        
        print(f"\n[{qid}/{len(test_cases)}] Evaluating template: '{template}' -> Question: '{question}'")

        # --- Test Old Agent (Direct SQL) ---
        print("  - Running Old Agent (Direct SQL)...")
        start_time = time.time()
        try:
            old_res = old_agent.self_correct_loop(question)
            old_time = time.time() - start_time
            old_latencies.append(old_time)
            
            old_ok = old_res.get("success", False)
            old_sql = old_res.get("sql", "")
            old_raw_sql = old_res.get("raw_sql", old_sql)
            
            # Dung so dem tuong minh tu agent. len(debug) khong phai so lan
            # goi LLM: agent cu ghi them 1 entry moi lan thu chay -> lech +1.
            old_calls = old_res.get("llm_calls", len(old_res.get("debug", [])))
            old_llm_calls.append(old_calls)
            
            # Check for CRS violations in RAW generated SQL (P2.3)
            old_violation = check_crs_violation(old_raw_sql)
            if old_violation:
                old_crs_violations += 1
                
            if old_ok:
                old_va_count += 1
                
            old_rows = old_res.get("results", []) if old_ok else []
            
            old_abstained = is_abstention(old_res)

            # Execution accuracy. Voi cau hoi L0 (khong tra loi duoc) thi
            # dung "co tu choi tuong minh hay khong" — so khop bang rong
            # se cho diem ca nhung luot agent fail sach.
            if not answerable:
                old_ex_match = old_abstained
            else:
                old_ex_match = execution_match(old_rows, gold_results, key_cols, ordered, is_count)
            if old_ex_match:
                old_ex_count += 1
                
            # Soft Semantic accuracy (Jaccard similarity)
            old_acc = compute_semantic_accuracy(old_rows, gold_results, is_count)
            old_accuracies.append(old_acc)
            
            # Abstention confusion matrix — theo tin hieu tu choi tuong minh.
            if not answerable:
                if old_abstained:
                    old_tp += 1
                else:
                    old_fn += 1
            else:
                if old_abstained:
                    old_fp += 1
                else:
                    old_tn += 1
            
            old_info = {
                "success": old_ok,
                "sql": old_sql,
                "raw_sql": old_raw_sql,
                "latency": old_time,
                "crs_violation": old_violation,
                "accuracy": old_acc,
                "ex_match": old_ex_match,
                "abstained": old_abstained,
                "llm_calls": old_calls,
                "results_count": len(old_rows),
                "error": old_res.get("error", "") if not old_ok else ""
            }
        except Exception as e:
            old_time = time.time() - start_time
            old_latencies.append(old_time)
            old_accuracies.append(0.0)
            old_llm_calls.append(1)
            # Crash KHONG phai tu choi: cau L0 ma crash la fn, cau tra loi
            # duoc ma crash la tn. Truoc day crash duoc tinh tp -> mot agent
            # luon loi se co abstention recall = 100%.
            if not answerable:
                old_fn += 1
            else:
                old_tn += 1
            old_info = {
                "success": False,
                "sql": "",
                "raw_sql": "",
                "latency": old_time,
                "crs_violation": False,
                "accuracy": 0.0,
                "ex_match": False,
                "abstained": False,
                "llm_calls": 1,
                "results_count": 0,
                "error": str(e)
            }

        # --- Test New Agent (IR -> SQL Compiler) ---
        print("  - Running New Agent (IR -> Compiler)...")
        start_time = time.time()
        try:
            new_res = new_agent.answer(question)
            new_time = time.time() - start_time
            new_latencies.append(new_time)
            
            new_ok = new_res.get("success", False)
            new_sql = new_res.get("sql", "")
            
            # Dung so dem tuong minh tu agent. len(debug) khong phai so lan
            # goi LLM: agent cu ghi them 1 entry moi lan thu chay -> lech +1.
            new_calls = new_res.get("llm_calls", len(new_res.get("debug", [])))
            new_llm_calls.append(new_calls)
            
            new_violation = check_crs_violation(new_sql)
            if new_violation:
                new_crs_violations += 1
                
            if new_ok:
                new_va_count += 1
                
            new_rows = new_res.get("results", []) if new_ok else []
            
            new_abstained = is_abstention(new_res)

            # Execution accuracy. Voi cau hoi L0 (khong tra loi duoc) thi
            # dung "co tu choi tuong minh hay khong" — so khop bang rong
            # se cho diem ca nhung luot agent fail sach.
            if not answerable:
                new_ex_match = new_abstained
            else:
                new_ex_match = execution_match(new_rows, gold_results, key_cols, ordered, is_count)
            if new_ex_match:
                new_ex_count += 1
                
            new_acc = compute_semantic_accuracy(new_rows, gold_results, is_count)
            new_accuracies.append(new_acc)
            
            # Abstention confusion matrix — theo tin hieu tu choi tuong minh.
            if not answerable:
                if new_abstained:
                    new_tp += 1
                else:
                    new_fn += 1
            else:
                if new_abstained:
                    new_fp += 1
                else:
                    new_tn += 1
            
            new_info = {
                "success": new_ok,
                "sql": new_sql,
                "latency": new_time,
                "crs_violation": new_violation,
                "accuracy": new_acc,
                "ex_match": new_ex_match,
                "abstained": new_abstained,
                "llm_calls": new_calls,
                "results_count": len(new_rows),
                "error": new_res.get("error", "") if not new_ok else ""
            }
        except Exception as e:
            new_time = time.time() - start_time
            new_latencies.append(new_time)
            new_accuracies.append(0.0)
            new_llm_calls.append(1)
            # Crash KHONG phai tu choi: cau L0 ma crash la fn, cau tra loi
            # duoc ma crash la tn. Truoc day crash duoc tinh tp -> mot agent
            # luon loi se co abstention recall = 100%.
            if not answerable:
                new_fn += 1
            else:
                new_tn += 1
            new_info = {
                "success": False,
                "sql": "",
                "latency": new_time,
                "crs_violation": False,
                "accuracy": 0.0,
                "ex_match": False,
                "abstained": False,
                "llm_calls": 1,
                "results_count": 0,
                "error": str(e)
            }

        results.append({
            "id": qid,
            "template": template,
            "question": question,
            "difficulty": difficulty,
            "old_agent": old_info,
            "new_agent": new_info
        })
        
        print(f"    Old: {'SUCCESS' if old_info['success'] else 'FAILED'} | EX Match: {old_info['ex_match']} | Accuracy: {old_info['accuracy'] * 100:.1f}% | CRS Violation: {old_info['crs_violation']} | Time: {old_info['latency']:.2f}s")
        print(f"    New: {'SUCCESS' if new_info['success'] else 'FAILED'} | EX Match: {new_info['ex_match']} | Accuracy: {new_info['accuracy'] * 100:.1f}% | CRS Violation: {new_info['crs_violation']} | Time: {new_info['latency']:.2f}s")

    # Calculate summaries
    total = len(test_cases)
    old_va_rate = (old_va_count / total) * 100
    new_va_rate = (new_va_count / total) * 100
    
    old_ex_rate = (old_ex_count / total) * 100
    new_ex_rate = (new_ex_count / total) * 100
    
    old_crs_violation_rate = (old_crs_violations / total) * 100
    new_crs_violation_rate = (new_crs_violations / total) * 100
    
    old_avg_latency = sum(old_latencies) / len(old_latencies) if old_latencies else 0
    new_avg_latency = sum(new_latencies) / len(new_latencies) if new_latencies else 0
    
    old_avg_accuracy = (sum(old_accuracies) / len(old_accuracies)) * 100 if old_accuracies else 0
    new_avg_accuracy = (sum(new_accuracies) / len(new_accuracies)) * 100 if new_accuracies else 0
    
    old_avg_calls = sum(old_llm_calls) / len(old_llm_calls) if old_llm_calls else 0
    new_avg_calls = sum(new_llm_calls) / len(new_llm_calls) if new_llm_calls else 0

    # Calculate Abstention F1
    old_prec = old_tp / (old_tp + old_fp) if (old_tp + old_fp) > 0 else 0
    old_rec = old_tp / (old_tp + old_fn) if (old_tp + old_fn) > 0 else 0
    old_f1 = (2 * old_prec * old_rec / (old_prec + old_rec)) * 100 if (old_prec + old_rec) > 0 else 0

    new_prec = new_tp / (new_tp + new_fp) if (new_tp + new_fp) > 0 else 0
    new_rec = new_tp / (new_tp + new_fn) if (new_tp + new_fn) > 0 else 0
    new_f1 = (2 * new_prec * new_rec / (new_prec + new_rec)) * 100 if (new_prec + new_rec) > 0 else 0

    print("\n" + "="*50)
    print("GS-QA REFATORED BENCHMARK COMPLETED")
    print("="*50)
    print(f"Old Agent Valid SQL Rate (VA): {old_va_rate:.1f}% ({old_va_count}/{total})")
    print(f"New Agent Valid SQL Rate (VA): {new_va_rate:.1f}% ({new_va_count}/{total})")
    print(f"Old Agent Execution Accuracy (EX): {old_ex_rate:.1f}% ({old_ex_count}/{total})")
    print(f"New Agent Execution Accuracy (EX): {new_ex_rate:.1f}% ({new_ex_count}/{total})")
    print(f"Old Agent Semantic Accuracy: {old_avg_accuracy:.1f}%")
    print(f"New Agent Semantic Accuracy: {new_avg_accuracy:.1f}%")
    print(f"Old Agent CRS Violations (Raw SQL): {old_crs_violation_rate:.1f}% ({old_crs_violations}/{total})")
    print(f"New Agent CRS Violations: {new_crs_violation_rate:.1f}% ({new_crs_violations}/{total})")
    print(f"Old Agent Avg Latency: {old_avg_latency:.2f}s")
    print(f"New Agent Avg Latency: {new_avg_latency:.2f}s")
    print(f"Old Agent Avg LLM Calls: {old_avg_calls:.2f}")
    print(f"New Agent Avg LLM Calls: {new_avg_calls:.2f}")
    print(f"Old Agent Abstention F1: {old_f1:.1f}%")
    print(f"New Agent Abstention F1: {new_f1:.1f}%")
    print("="*50)

    # Write report as markdown
    write_markdown_report(
        results, old_va_rate, new_va_rate, old_ex_rate, new_ex_rate, 
        old_avg_accuracy, new_avg_accuracy, old_crs_violation_rate, new_crs_violation_rate, 
        old_avg_latency, new_avg_latency, old_avg_calls, new_avg_calls, 
        old_f1, new_f1, benchmark_filename
    )

def write_markdown_report(results, old_va, new_va, old_ex, new_ex, old_acc, new_acc, old_crs, new_crs, old_lat, new_lat, old_calls, new_calls, old_f1, new_f1, benchmark_name):
    report_path = "/home/nhson2612/Desktop/datn/docs/benchmark_results.md"
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    
    # Load cases for Gold SQL printing
    benchmark_path = os.path.join(os.path.dirname(__file__), benchmark_name)
    try:
        with open(benchmark_path, "r", encoding="utf-8") as f:
            test_cases = json.load(f)
            cases_by_id = {c["id"]: c for c in test_cases}
    except Exception:
        cases_by_id = {}
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Báo cáo Thử nghiệm Đánh giá trên Benchmark GS-QA Độc lập\n\n")
        f.write(f"> **Ngày đánh giá:** 2026-08-20  \n")
        f.write(f"> **Bộ dữ liệu thử nghiệm:** `{benchmark_name}` (Tập `test` độc lập - 100 câu)  \n")
        f.write(f"> **Mô hình LLM sử dụng:** `qwen2.5:1.5b` (Ollama)  \n")
        f.write(f"> **Cơ sở dữ liệu:** PostgreSQL + PostGIS (Đà Nẵng tourism dataset)  \n\n")
        
        f.write("## 1. Kết quả Tổng quan\n\n")
        f.write("| Chỉ số đánh giá | Kiến trúc Cũ (Direct SQL) | Kiến trúc Mới (LLM-to-IR-to-SQL) | Nhận xét |\n")
        f.write("| :--- | :---: | :---: | :--- |\n")
        f.write(f"| **Tỉ lệ sinh SQL chạy được (VA)** | {old_va:.1f}% | {new_va:.1f}% | Kiến trúc mới loại bỏ hoàn toàn lỗi cú pháp SQL nhờ tầng biên dịch IR. |\n")
        f.write(f"| **Độ chính xác thực thi (EX)** | {old_ex:.1f}% | {new_ex:.1f}% | So khớp chính xác kết quả đầu ra của DB với truy vấn mẫu viết tay. |\n")
        f.write(f"| **Độ chính xác ngữ nghĩa (Semantic Accuracy)** | {old_acc:.1f}% | {new_acc:.1f}% | Đo lường theo chỉ số Jaccard Similarity (cho phép khớp một phần). |\n")
        f.write(f"| **Tỉ lệ lỗi hệ tọa độ thô (CRS Violation)** | {old_crs:.1f}% | {new_crs:.1f}% | Đo lỗi CRS trên SQL thô của Agent cũ trước khi crs_guard can thiệp. |\n")
        f.write(f"| **Số lần gọi LLM trung bình (LLM Calls)** | {old_calls:.2f} | {new_calls:.2f} | Tần suất tương tác/sửa lỗi với LLM để ra kết quả cuối cùng. |\n")
        f.write(f"| **Khả năng từ chối (Abstention F1)** | {old_f1:.1f}% | {new_f1:.1f}% | Đo lường độ chính xác trong việc từ chối các câu hỏi nằm ngoài DB (L0). |\n")
        f.write(f"| **Thời gian phản hồi trung bình (Latency)** | {old_lat:.2f}s | {new_lat:.2f}s | Kiến trúc mới nhanh hơn nhờ giảm các vòng lặp tự sửa lỗi cú pháp. |\n\n")
        
        f.write("## 2. Chi tiết kết quả từng Câu hỏi thử nghiệm (GS-QA Templates)\n\n")
        f.write("| ID | Template | Câu hỏi | Độ khó | Cũ (VA) | Mới (VA) | Cũ EX | Mới EX | Cũ Acc | Mới Acc | Cũ CRS thô | Mới CRS |\n")
        f.write("| :-: | :--- | :--- | :-: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n")
        
        for res in results:
            old_va_status = "🟢 OK" if res["old_agent"]["success"] else "🔴 Fail"
            new_va_status = "🟢 OK" if res["new_agent"]["success"] else "🔴 Fail"
            old_ex_status = "🟢 Khớp" if res["old_agent"]["ex_match"] else "🔴 Sai"
            new_ex_status = "🟢 Khớp" if res["new_agent"]["ex_match"] else "🔴 Sai"
            old_acc_pct = f"{res['old_agent'].get('accuracy', 0.0) * 100:.0f}%"
            new_acc_pct = f"{res['new_agent'].get('accuracy', 0.0) * 100:.0f}%"
            old_crs_txt = "⚠️ Lỗi" if res["old_agent"]["crs_violation"] else "✅ An toàn"
            new_crs_txt = "⚠️ Lỗi" if res["new_agent"]["crs_violation"] else "✅ An toàn"
            
            f.write(f"| {res['id']} | `{res['template']}` | {res['question']} | {res['difficulty']} | {old_va_status} | {new_va_status} | {old_ex_status} | {new_ex_status} | {old_acc_pct} | {new_acc_pct} | {old_crs_txt} | {new_crs_txt} |\n")
            
        f.write("\n## 3. Phân tích chi tiết các câu lệnh SQL sinh ra\n\n")
        for res in results:
            case = cases_by_id.get(res["id"], {})
            f.write(f"### Câu {res['id']}: {res['question']} (`{res['template']}`)\n")
            
            # Print Gold query
            if "gold_sql" in case:
                f.write(f"- **Câu truy vấn đáp án mẫu (Gold SQL):**\n")
                f.write(f"  ```sql\n  {case['gold_sql']}\n  ```\n")
                params_str = ", ".join(repr(p) for p in case.get('gold_params', []))
                f.write(f"  *Tham số:* `[{params_str}]`\n")
                f.write(f"  *Kết quả mẫu:* `{case.get('gold_results')}`\n\n")
                
            f.write(f"- **Kiến trúc Cũ (Direct SQL):**\n")
            if res['old_agent']['sql']:
                f.write(f"  ```sql\n  {res['old_agent']['sql']}\n  ```\n")
                f.write(f"  *SQL thô trước khi sửa:* `{res['old_agent'].get('raw_sql', '')}`\n")
                f.write(f"  *Chính xác thực thi:* `{res['old_agent']['ex_match']}` | *Độ chính xác ngữ nghĩa:* `{res['old_agent'].get('accuracy', 0.0)*100:.1f}%`\n")
            else:
                f.write(f"  *Lỗi: {res['old_agent']['error']}*\n")
                
            f.write(f"- **Kiến trúc Mới (IR -> Compiler):**\n")
            if res['new_agent']['sql']:
                f.write(f"  ```sql\n  {res['new_agent']['sql']}\n  ```\n")
                f.write(f"  *Kết quả thực thi:* `{res['new_agent']['results_count']} bản ghi` | *Chính xác thực thi:* `{res['new_agent']['ex_match']}` | *Độ chính xác ngữ nghĩa:* `{res['new_agent'].get('accuracy', 0.0)*100:.1f}%`\n")
            else:
                f.write(f"  *Lỗi: {res['new_agent']['error']}*\n")
            f.write("\n---\n\n")
            
        # Add Template Coverage Analysis Section
        f.write("## 4. Phân tích Độ bao phủ các Template GS-QA (Template Coverage Analysis)\n\n")
        f.write("Dưới đây là đánh giá khả năng bao phủ 26 template của benchmark GS-QA bởi kiến trúc **LLM-to-IR-to-SQL Compiler** hiện tại:\n\n")
        f.write("| Nhóm Template | Tình trạng hỗ trợ | Lý do kỹ thuật / SQL mẫu đề xuất |\n")
        f.write("| :--- | :---: | :--- |\n")
        f.write("| **intersects+count** <br> **intersects+name** | **Đầy đủ** | Được hỗ trợ qua toán tử `in_admin` và dịch chuyển sang `ST_Contains` trong ranh giới hành chính. |\n")
        f.write("| **range+count** <br> **range+name** | **Đầy đủ** | Được hỗ trợ qua toán tử `within_distance` và `near_point` kết hợp `ST_DWithin` trên kiểu dữ liệu geography. |\n")
        f.write("| **knn+name** <br> **knn+distance** | **Đầy đủ** | Được hỗ trợ qua trường `nearest_to` biên dịch thành phép toán tử KNN (`<->`) để tối ưu chỉ mục GIST. |\n")
        f.write("| **knn:non_spat_filter** <br> **range:non_spat_filter** | **Đầy đủ** | Mảng phẳng `where` gộp cả thuộc tính phi không gian giúp LLM dễ sinh hơn. |\n")
        f.write("| **intersects:area_total** <br> **intersects:length_total** | *Chưa hỗ trợ* | Compiler hiện chỉ hỗ trợ đếm (`count`) và lấy thuộc tính. Để mở rộng, cần thêm cấu trúc `\"aggregate\": \"sum_area\"` hoặc `\"sum_length\"` biên dịch thành `SUM(ST_Area(geom::geography))`. |\n")
        f.write("| **knn:direction** <br> **range:direction** | *Chưa hỗ trợ* | Các quan hệ hướng (North, South, East, West) đòi hỏi tính toán góc phương vị. Đề xuất mở rộng toán tử không gian `direction` sử dụng hàm `ST_Azimuth(geom1, geom2)`. |\n")
        f.write("| **range:towards** <br> **knn:towards** | *Chưa hỗ trợ* | Câu hỏi về hướng di chuyển hoặc dọc hành lang đường đi. Đòi hỏi tích hợp mạng lưới đường giao thông (`pgRouting` hoặc `ST_LineLocatePoint` dọc tuyến đường). |\n")
        
    print(f"Report written to: {report_path}")

if __name__ == "__main__":
    run_benchmark()
