# LiScript
LiScript replaces JavaScript's syntax by lisp's powerful S-Expressions and macro system.

#### Installation

There's no established installation procedure for now.
You can:
* download liscript.js;
* require the file using Node;
* pass your code by `LiScript.compile("(your source code)")` (returns the compiled JavaScript code);
* ???
* PROFIT!
Your code needs to use linefeeds, or unexpected errors will occur (comments won't work too).

#### Quick Tutorial / Using

The language core is very easy. It has 4 basic forms, which map directly to their JavaScript counterparts:

* String: `"this is a string"`
* Array: `["this" "is" "an" "array"]`
* Object: `{foo 5 bar 7}`
* Function/macro calling: `(func 1 2 3)`

In Lisp everything is a expression, i.e., every command can be replaced by the value it returns.
Unfortunately, not all LiScript's words can return values because there are constructs in JavaScript that are statements, they can't be used in place of expressions.
Actually, these words are `let ret throw`.
You still can use these in places that accept statements (they're the majority), or create a closure when necessary.

Commentaries:
```
; This is a single-line commentary
(code) ; You mustn't put a comment in front of code
; By the way the line above is invalid syntax and the compiler will bite you :B
```

Builtin functions:

* Math operators: `+ - * / %`
```
(+ 1 2 3 (* 2 2))
; 10
```
* Boolean comparisons: `and or same = != < > <= >= yes`
```
(= 2 2)
; true
```
`same` is the equivalent of `===` in JavaScript.

`yes` is a convenience function, it does a double negation:
```
(yes someObject)
; !(!(someObject) )
```
* Modifying atribution operators: `add sub mul div mod`
```
(let a 1) (add a 1)
; var a=1; a+=1
```
* Bitwise operators: `<< >>`
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
* Conditional: `if switch`
```
(let rnd (Math.random))
(if (< rnd 0.05)
    (console.log "You won :D")
    (console.log "Bad luck, try again."))
; Output: who knows?
```
`switch` is like the JavaScript's `switch`, but dressed in a new syntax (and inside a closure).
It returns the value of the second command in the body which was selected (or the "default" expression value).
```
(let value 1)
(switch value
        (1 (console.log "One"))
        (2 (console.log "Two"))
        (3 (console.log "Three"))
        ( (console.log "Default") ) )
; Output: "One"
```
* Function definition: `fun lam ret`
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
* Closure definition: `do void`

`do` permits you to create really temporary local variables, or place multiple commands where just there's place for one.
```
(do (something 1) (something 2) (something 3) )
; (function() {something(1); something(2); return something(3); })()
```
`void` works much like `do`, but always returns `null`.
```
(void (something 1) (something 2) (something 3) )
; (function() {something(1); something(2); something(3); return null; })()
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
(. a (replace "1" "9") (replace "3" "7") )
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
```
(while (def i 0) (< i 4)
       (console.log i) (add i 1) )
; Output: 0 1 2 3
```
* Iteration: `iter`

`iter` binds 3 temporary variables inside a closure:

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
(chain func [1 2 3] [4 5 6] [7 8 9])
; func(1,2,3)(4,5,6)(7,8,9)
; That is cleaner than it's equivalent in plain syntax:
(((func 1 2 3) 4 5 6) 7 8 9)
```
* Exceptions: `try throw`

`try`'s sintax resembles `switch`'s syntax.
Like JavaScript's `try`, you have 3 (1 optional) code bodies: the normal code body (first `try`'s part), the exception treatment code body (`catch`'s body) and the finisher body (`finally`'s body).
You must place your commands inside the correspondent parentheses body pair.
```
(try ( (something 1)(something 2) )
     ( (error _) )
     ( (finally 1)(finally 2) ) )
; try {
;   something(1);something(2);
; } catch (_) {
;   error(_)
; } finally {
;  finally(1); finally(2);
; }
```
Note that `throw` isn't a valid JavaScript expression, it's a statement (it doesn't return a value).
```
(throw "Incorrect value")
; throw("Incorrect value");
```
* Macro: `defmacro`

Macros work by modifying the code **before** it's compiled to JavaScript, and it couldn't be easier: just return an array of strings representing the new form of your code! Let's make a macro that inverts an expression:
```
(defmacro swap (a b) [b a])
(swap "test" console.log)
; This becomes `(console.log "test")` which outputs `"test"`!
```
Another example:
```
(defmacro unless (cond T F) ["if" cond F T])
(def yell (fn (a) (call a "toUpperCase")))
(def im_sad false)
(unless im_sad (yell "What a great day!"))
; Output: "WHAT A GREAT DAY!"
```
This is an interesting fact about Lisp: clever user of macros can make the language sound just like speech. There's no syntax: just a bunch of phrases that tell your program what to do. Sometimes it's too abstracted away you don't even notice you are programming: `(make me a sandwitch in 2 hours)`, one could perfectly make this work. Lisp code from a great hacker is a piece of art. But maybe you're the type that likes terse syntax and symbols? No problems...
* Readers: `defreader`

*(Readers aren't completely functional at the moment)*
Readers are similar to macros, except they work for special forms (not parenthesis). Readers on LiScript are a little different: you just define a name and enclosing symbols. You can, then, further process it with normal macros. For example, lets define the form < a > to return the square of a:
```
(defreader square < >)
(defmacro square (a) (mul a a))
(console.log <3>)
The form above becomes (console.log (square 3)),
which becomes (console.log (mul 3 3)),
which becomes (console.log 9),
which outputs 9.
```
That is much simpler than traditional reader macros! For more advanced cases you can just edit the parser itself: it's a 25-lines-long function on the source, so it shouldn't be hard. Given how no other lisp-to-js language implement reader macros at all, it's pure win.
