export type BcpBooking = {
  id: number;
  booking_status: number;
  start_datetime: string;
  end_datetime: string;
  customer_id: number | null;
  customer_name: string | null;
  room_bcp1: number;
  room_bcp2: number;
  meeting_room: number | null;
  seating_nbr: number | null;
  business_continuity: number | null;
  disaster_recovery: number | null;
  comment: string | null;
  purpose: string | null;
  updated_at: string;
  created_at: string;
};
