(let
  fatorial (function (proc)
    (function (n)
      (if (<= n 1)
        1
        (* n (proc (- n 1))) )))
  Y (function (exter)
    (let inter (function (proc)
      (let aplica (function (arg)
        (chain proc (proc)(arg)) ))
      (exter aplica) ))
    (inter inter) )
)
(console.log (+ "5! é " (chain Y (fatorial)(5)) ))
