# LiScript
LiScript replaces JavaScript's syntax by lisp's powerful S-expressions ~~and macro system~~.

#### Using the compiler
I've implemented a reader interface system, that permits the compiler to operate uniformly over any type of input.
An example using the "plain text" reader (the only one implemented at the moment):
```
var program = '(chain a (1) (2 3))'
var reader = new Reader_plain_text(program)
var compi = new Liscript_compiler(reader)
var ret = compi.compile_all()
eval(ret)
```

#### LiScript Fundamentals

LiScript is a tiny layer on top of JavaScript. It has some basic forms, which map directly to their JavaScript counterparts:

* String: `"this is a string"`
* Array: `["this" "is" "an" "array"]`
* Object: `{foo 5 "bar" 7}`
* Regular Expression: `/[^a]$/g`
* Function~~/macro~~ calling: `(func 1 2 3)`

In Lisp everything is a expression, i.e., every command can be replaced by the value it returns.
Unfortunately, not all LiScript's words can return values because there are constructs in JavaScript that are statements, they can't be used in place of expressions.
Actually, these words are `let ret ifret throw error type_error block`.
You still can use these in places that accept statements, or create a closure when necessary.

Commentaries:
```
; This is a single-line commentary
(code) ; You can place your comments anywhere
; Just remember that everything between the semicolon and the end of the line will be ignored by the compiler
```

Builtin functions:

* Math operators: `+ - * / % neg`
```
(+ 1 2 3 (* 2 2))
; 10
(neg 1)
; (-1)
```
* Boolean comparisons: `and or xor same = != < > <= >= instanceof`
```
(= 2 2)
; true
(xor true true)
; false
```
`same` is the equivalent of `===` in JavaScript, `=` is the equivalent of `==`.

* Modifying atribution operators: `+= -= *= /= %=`
```
(let a 1) (+= a 1)
```
* Bitwise operators: `<< >> >>>`
* Global (multiple) assignment: `def`
```
(def abc 1 def 2 ghi 3)
; abc=1, def=2, ghi=3
```
* Local (multiple) assignment: `let`

`let` doesn't create a valid JavaScript expression (i.e. you can't expect a value coming from a `let` call).
I strongly recommend to always use `let`, except if you really want to create global variables.
```
(let abc 1 def 2 ghi 3)
; var abc=1, def=2, ghi=3
```
* Conditional: `if cond switch`
```
(let rnd (Math.random))
(if (< rnd 0.5)
    (console.log "You won :D")
    (console.log "Bad luck, try again."))
; Output: who knows?
```
`cond` does successive logical tests inside a closure:
```
(cond
    (and (< a 5) (> a 1))  (console.log "first case")
    (and (< a 10) (>= a 5))  (console.log "second case")
    (console.log "none of the above") )
; if ((a<5)&&(a>1)) {...} else if ((a>=5)&&(a<10)) {...} else {...}
```
`switch` is like the JavaScript's `switch`, but dressed in a new syntax (and inside a closure).
It expects a value, and test-evaluate expression pairs. If one expression remais alone in the end, it falls into the `default:` case. You can return a value from the closure using `ret`, of course.
```
(let value 1)
(switch value
        1 (console.log "One")
        2 (console.log "Two")
        3 (console.log "Three")
        (console.log "Default") )
; Output: "One"
```
* Function and closure facilities: `fun lam ret do block`
```
(fun (a b) (+ a b))
; function (a,b) { return a+b; };
```
`lam` is a function with only one fixed argument name: `_`. Intended for quick jobs.
```
(lam (+ _ 1))
; function (_) { return _+1; };
```
`ret` exits the function prematurely.

Note that `return` isn't a valid expression in JavaScript (i.e. you can't do `var a = return 1;`)
```
(fun (a b) (ret 4) (+ a b))
; function (a, b) { return 4; return a+b; };
```
`do` stacks expressions with commas:
```
(do (do_something 1) (do_something 2) (do_something 3))
; do_something(1),do_something(2),do_something(3)
```
`block` creates a block of expressions. Statements allowed:
```
(block (do_something 1) (do_something 2) (do_something 3))
; do_something(1);do_something(2);do_something(3)
```
* Member access: `get set .`
```
(def my_obj {a 1 b 2 c 3})
(set my_obj "b" 4)
; my_obj["b"] = 4;
(console.log (get my_obj "b"))
; console.log( my_obj["b"] );
; Output: 4
```
The dot operator (`.`) is very useful to accessing fluent interfaces (chained named function calls) and deep properties.
```
(let a "12345")
(def a (. a (replace "1" "9") (replace "3" "7") ) )
; a.replace("1","9").replace("3","7")
(console.log a)
; Output: "92745"
```
* Instantiating a object: `new`
```
(new MyClass 1 2 3)
; new MyClass(1,2,3)
```
* Loop: `while`

`while` runs a while-loop inside a closure. It expects 3 or 4 arguments: preset commands (runs before the loop), loop test, loop body and (optionally) a after-loop body.
```
(while (let i 0) (< i 4)
       (do (console.log i) (+= i 1))
       (ret i) )
; Output: 0 1 2 3
```
* Iteration: `iter`

`iter` iterates over an object. It expects 2 or 3 arguments: the object to be iterated, the iteration code body, and (optionally) a after-iteration body.

It binds 3 temporary variables:

`obj_`: the object being iterated;
`key`: the key being accessed at the moment;
`val`: the value being accessed at the moment.
```
(iter {a 1 b 2 c 3}
      (console.log [key val]))
; Output: ["a",1] ["b",2] ["c",3]
```
* Function chain calling: `chain`

With `chain` you can conveniently call a function returned by a function, returned by a function, returned...
```
(chain func (1 2 3) (4 5 6) (7 8 9))
; func(1,2,3)(4,5,6)(7,8,9)
; That is cleaner than it's equivalent in plain syntax:
(((func 1 2 3) 4 5 6) 7 8 9)
```
* Exceptions: `try throw error type_error`

`try` tries to run a piece of code inside a closure, and runs the second body (`catch` body) if a exception was thrown. If present, a third body (`finally` body) is evaluated at the end. The `catch` body binds the thrown exception at `_` variable.
```
(try (block (something 1) (something 2) )
     (deal_with_error _)
     (block (finally_do 1) (finally_do 2)) )
; try {
;   something(1); something(2);
; } catch (_) {
;   deal_with_error(_);
; } finally {
;  finally(1); finally(2);
; }
```
Note that `throw` isn't a valid JavaScript expression, it's a statement (it doesn't return a value).
```
(throw "Incorrect value")
; throw("Incorrect value");
```
`error` throws a `Error()` exception, passing the arguments forward. `type_error` throws a `TypeError()` exception.

* Conveniences: `nop args`

`nop` doesn't emit JavaScript code, and ignores its arguments. It's the LiScript no-op.

`args` accesses the `arguments` array-like object. It only allows reading:
```
(args 1)
; (arguments.length>1 ? arguments[1] : undefined)
```

~~* Macro: `defmacro`~~
~~* Readers: `defreader`~~
*(Readers and macros aren't functional at the moment...)*
