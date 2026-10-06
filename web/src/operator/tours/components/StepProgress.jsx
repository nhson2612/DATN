/** Thanh bước: mỗi bước một vạch màu, số thứ tự, tên bước. Bước xong hiện dấu tích. */
export default function StepProgress({ steps, current, onGo }) {
  return (
    <nav className="op-wizard__steps" aria-label="Các bước tạo tour">
      {steps.map((step, index) => {
        const daXong = index < current;
        const dangMo = index === current;
        return (
          <button
            type="button"
            key={step.key}
            onClick={() => onGo(index)}
            title={`${index + 1}. ${step.nhan}`}
            className={`op-wizard__step    ${daXong ? "op-wizard__step--done" : ""}       ${
              dangMo ? "op-wizard__step--active" : ""
            }       ${index > current ? "op-wizard__step--todo" : ""}`}
          >
            <span className="op-wizard__step-bar" />
            <span className="op-wizard__step-line">
              <span className="op-wizard__step-number">{daXong ? "✓" : index + 1}</span>
              <span className="op-wizard__step-name">
                {index + 1}. {step.nhan}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
