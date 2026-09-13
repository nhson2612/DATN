import { useState } from "react";

import { api } from "../../../shared/api";

/** Đặt giá khuyến mãi cho một đợt: giá gốc vẫn giữ nguyên, giá bán là giá khách thấy. */
export default function SalePriceField({ departure, onSaved }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(departure.sale_price || "");

  if (!open) {
    return (
      <button className="op-link" onClick={() => setOpen(true)}>
        {departure.sale_price ? "Sửa giá sale" : "Đặt giá sale"}
      </button>
    );
  }

  const save = async () => {
    await api.setOperatorSale(departure.id, { sale_price: Number(price) });
    setOpen(false);
    onSaved();
  };

  return (
    <span className="op-inline">
      <input type="number" value={price} onChange={(event) => setPrice(event.target.value)} />
      <button onClick={save}>Lưu</button>
    </span>
  );
}
