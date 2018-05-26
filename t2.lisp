(macro generator (argslist)
  (verify_args "gen" arguments 2 0)
  (assert (is_arguments_list argslist)
    (error "gen: first argument must be a list"))
  (let body (Array.prototype.slice.call arguments 1 -1))
  (let ret (compile_token (args (- arguments.length 1))))
  (+
    "(function*(" (. (args 0) (map compile_token) (join ",")) ")"
    "{" (. body (map compile_token) (join ";"))
    (if (> ret.length 0) (+ ";return " ret) "") "})")
)

(macro for_of (value object)
  (verify_args "for_of" arguments 3 0)
  (let actions (Array.prototype.slice.call arguments 2))
  (+
    "for(" (compile_token value) " of " (compile_token object) ")"
    "{" (. actions (map compile_token) (join ";")) "}")
)

(let
  a (generator (x)
    (yield x)
    (yield (- x 1)) (nop) )
  b (a 8)
)
(for_of val b
  (console.log val) )



