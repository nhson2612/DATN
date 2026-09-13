/** Một ô số liệu trong dải số liệu của màn doanh thu. */
export default function StatBox({ label, value }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
