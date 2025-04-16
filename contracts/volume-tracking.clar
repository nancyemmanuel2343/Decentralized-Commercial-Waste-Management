;; Volume Tracking Contract
;; Monitors waste quantities by category

(define-constant ERR_UNAUTHORIZED u403)
(define-constant ERR_NOT_FOUND u404)

;; Waste categories
(define-constant WASTE_GENERAL u1)
(define-constant WASTE_RECYCLABLE u2)
(define-constant WASTE_ORGANIC u3)
(define-constant WASTE_HAZARDOUS u4)

(define-map waste-records (tuple (business principal) (date uint))
  {
    general: uint,      ;; Volume in cubic meters (x100 for precision)
    recyclable: uint,
    organic: uint,
    hazardous: uint,
    collector: principal,
    timestamp: uint
  }
)

(define-map business-totals principal
  {
    general-total: uint,
    recyclable-total: uint,
    organic-total: uint,
    hazardous-total: uint,
    last-updated: uint
  }
)

(define-read-only (get-waste-record (business principal) (date uint))
  (map-get? waste-records (tuple (business business) (date date)))
)

(define-read-only (get-business-totals (business principal))
  (default-to
    {
      general-total: u0,
      recyclable-total: u0,
      organic-total: u0,
      hazardous-total: u0,
      last-updated: u0
    }
    (map-get? business-totals business)
  )
)

(define-public (record-waste-volume
    (business principal)
    (date uint)
    (general uint)
    (recyclable uint)
    (organic uint)
    (hazardous uint))
  (let ((caller tx-sender)
        (existing-totals (get-business-totals business)))

    ;; Record the waste volumes for this pickup
    (map-set waste-records (tuple (business business) (date date))
      {
        general: general,
        recyclable: recyclable,
        organic: organic,
        hazardous: hazardous,
        collector: caller,
        timestamp: block-height
      }
    )

    ;; Update the business totals
    (ok (map-set business-totals business
      {
        general-total: (+ (get general-total existing-totals) general),
        recyclable-total: (+ (get recyclable-total existing-totals) recyclable),
        organic-total: (+ (get organic-total existing-totals) organic),
        hazardous-total: (+ (get hazardous-total existing-totals) hazardous),
        last-updated: block-height
      }
    ))
  )
)

(define-read-only (get-total-waste (business principal))
  (let ((totals (get-business-totals business)))
    (+
      (get general-total totals)
      (get recyclable-total totals)
      (get organic-total totals)
      (get hazardous-total totals)
    )
  )
)

(define-read-only (get-recycling-percentage (business principal))
  (let ((totals (get-business-totals business))
        (total-waste (get-total-waste business)))
    (if (is-eq total-waste u0)
      u0
      (/ (* u10000 (get recyclable-total totals)) total-waste) ;; Returns percentage x100 for precision
    )
  )
)
