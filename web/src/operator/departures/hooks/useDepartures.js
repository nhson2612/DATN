import { useCallback, useEffect, useState } from "react";

import { api } from "../../../shared/api";

/**
 * Tải danh sách tour của nhà điều hành, giữ tour đang chọn,
 * và tải các đợt khởi hành của tour đó. Màn đợt khởi hành và màn huỷ đợt dùng chung.
 */
export default function useDepartures() {
  const [tours, setTours] = useState([]);
  const [tourId, setTourId] = useState("");
  const [departures, setDepartures] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .operatorTours({ page_size: 100 })
      .then((data) => {
        const list = data.tours || [];
        setTours(list);
        if (list[0]) setTourId(String(list[0].id));
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const reload = useCallback(() => {
    if (!tourId) return Promise.resolve();
    return api
      .operatorDepartures(tourId)
      .then((data) => setDepartures(data.departures || []))
      .catch((error) => setMessage(error.message));
  }, [tourId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tours, tourId, setTourId, departures, reload, message, setMessage };
}
