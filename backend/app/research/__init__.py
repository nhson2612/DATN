"""Phần nghiên cứu của luận văn — ĐÓNG GÓP KHOA HỌC, không refactor.

  ir.py               trình biên dịch IR -> SQL (đóng góp chính)
  ir_agent.py         LLM -> IR, grounding, phát hiện nhập nhằng
  agent_legacy.py     baseline LLM -> SQL trực tiếp
  gold_templates.py   gold SQL viết tay, độc lập với ir.py
  generate_benchmark.py / run_benchmark.py

Mọi thay đổi trong các file này đều dịch số benchmark mà luận văn trích dẫn.
Chỉ sửa khi biết rõ mình đang dịch số nào.
"""
