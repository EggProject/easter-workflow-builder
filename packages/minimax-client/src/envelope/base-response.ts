/**
 * A MiniMax válaszok közös `base_resp` burkolója. A `status_code` nulla értéke
 * a siker, minden más hiba, a `status_msg` pedig a hiba szövege.
 */
export interface MiniMaxBaseResponse {
  readonly status_code: number;
  readonly status_msg: string;
}

/**
Bármely MiniMax válasz, amiben megvan a `base_resp` burkoló.
*/
export interface MiniMaxEnvelope {
  readonly base_resp: MiniMaxBaseResponse;
}
