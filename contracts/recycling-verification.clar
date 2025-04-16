;; Recycling Verification Contract
;; Tracks diversion from landfills

(define-constant ERR_UNAUTHORIZED u403)
(define-constant ERR_NOT_FOUND u404)
(define-constant ERR_INVALID_DATA u2)

(define-data-var admin principal tx-sender)

(define-map recycling-claims uint
  {
    business: principal,
    date: uint,
    waste-type: (string-utf8 20),
    volume: uint,
    recycled-volume: uint,
    status: uint,        ;; 0 = pending, 1 = verified, 2 = rejected
    verifier: (optional principal),
    verification-time: uint,
    evidence-hash: (buff 32)
  }
)

(define-data-var claim-counter uint u0)

(define-map business-recycling-stats principal
  {
    total-waste: uint,
    total-recycled: uint,
    diversion-rate: uint,  ;; Percentage x100 for precision
    carbon-offset: uint,   ;; kg of CO2 equivalent x100 for precision
    last-updated: uint
  }
)

(define-read-only (get-recycling-claim (claim-id uint))
  (map-get? recycling-claims claim-id)
)

(define-read-only (get-business-recycling-stats (business principal))
  (default-to
    {
      total-waste: u0,
      total-recycled: u0,
      diversion-rate: u0,
      carbon-offset: u0,
      last-updated: u0
    }
    (map-get? business-recycling-stats business)
  )
)

(define-public (submit-recycling-claim
    (date uint)
    (waste-type (string-utf8 20))
    (volume uint)
    (recycled-volume uint)
    (evidence-hash (buff 32)))
  (let ((caller tx-sender)
        (claim-id (+ (var-get claim-counter) u1)))

    (asserts! (<= recycled-volume volume) (err ERR_INVALID_DATA))

    (var-set claim-counter claim-id)
    (ok (map-set recycling-claims claim-id
      {
        business: caller,
        date: date,
        waste-type: waste-type,
        volume: volume,
        recycled-volume: recycled-volume,
        status: u0,
        verifier: none,
        verification-time: u0,
        evidence-hash: evidence-hash
      }
    ))
  )
)

(define-public (verify-recycling-claim (claim-id uint))
  (let ((claim (map-get? recycling-claims claim-id))
        (caller tx-sender))

    (asserts! (is-some claim) (err ERR_NOT_FOUND))
    (asserts! (is-eq caller (var-get admin)) (err ERR_UNAUTHORIZED))

    (let ((claim-data (unwrap-panic claim))
          (business (get business claim-data))
          (volume (get volume claim-data))
          (recycled-volume (get recycled-volume claim-data))
          (stats (get-business-recycling-stats business)))

      ;; Update the claim status
      (map-set recycling-claims claim-id
        (merge claim-data
          {
            status: u1,
            verifier: (some caller),
            verification-time: block-height
          }
        )
      )

      ;; Update business stats
      (ok (map-set business-recycling-stats business
        {
          total-waste: (+ (get total-waste stats) volume),
          total-recycled: (+ (get total-recycled stats) recycled-volume),
          diversion-rate: (if (is-eq (+ (get total-waste stats) volume) u0)
                            u0
                            (/ (* u10000 (+ (get total-recycled stats) recycled-volume))
                               (+ (get total-waste stats) volume))),
          carbon-offset: (+ (get carbon-offset stats) (* recycled-volume u120)), ;; Assume 1.2 kg CO2e per unit
          last-updated: block-height
        }
      ))
    )
  )
)

(define-public (reject-recycling-claim (claim-id uint))
  (let ((claim (map-get? recycling-claims claim-id))
        (caller tx-sender))

    (asserts! (is-some claim) (err ERR_NOT_FOUND))
    (asserts! (is-eq caller (var-get admin)) (err ERR_UNAUTHORIZED))

    (ok (map-set recycling-claims claim-id
      (merge (unwrap-panic claim)
        {
          status: u2,
          verifier: (some caller),
          verification-time: block-height
        }
      )
    ))
  )
)

(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_UNAUTHORIZED))
    (ok (var-set admin new-admin))
  )
)
