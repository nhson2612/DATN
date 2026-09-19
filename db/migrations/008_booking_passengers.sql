CREATE TABLE IF NOT EXISTS booking_passengers (
    id BIGSERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES tour_bookings(id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    UNIQUE (booking_id, sequence_no)
);
CREATE INDEX IF NOT EXISTS booking_passengers_booking_idx ON booking_passengers(booking_id);
