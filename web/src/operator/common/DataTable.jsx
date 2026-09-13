/** Bảng dữ liệu dùng chung cho các màn của nhà điều hành. */
export default function DataTable({ heads, children }) {
  return (
    <div className="op-table">
      <table>
        <thead>
          <tr>
            {heads.map((head) => (
              <th key={head}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
