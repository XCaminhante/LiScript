# LiScript
LiScript substitui a sintaxe JS com as poderosas expressões S(imbólicas) e as macros de Lisp.
A linguagem ainda está instável, tenha paciência.

### Usando o compilador
LiScript possui uma interface de console em Node.JS.
Experimente compilar os exemplos que acompanham o compilador, depois os executar:
```
node compilar_liscript.js t.lisp t2.lisp
node t.js
node t2.js
```

Escrevi um sistema de interface de leitor de código, assim o núcleo do compilador não precisa saber de onde o código
está vindo.
Um exemplo usando o leitor de texto simples (o único implementado até o momento):
```
var program = '(chain a (1) (2 3))'
var reader = new Reader_plain_text(program)
var compi = new Liscript_compiler(reader)
var ret = compi.compile_all()
// Ou:
var program = '(chain a (1) (2 3))'
var compi = new Liscript_compiler()
compi.parser.def_reader(new Reader_plain_text(program))
var ret = compi.compile_all()
// ...
eval(ret)
```

### Fundamentos de LiScript

LiScript se apoia fortemente sobre o interpretador JS abaixo, modificando pouco além da sintaxe.
Ela tem algumas formas básicas que mapeiam diretamente para suas contrapartes em JS:

* Texto: `"this is a string"`
* Vetor: `["this" "is" "an" "array"]`
* Objeto: `{foo 5 "bar" 7}`
* Expressão regular: `/[^a]$/g`
* Chamada de função: `(func 1 2 3)`

Fora essas formas básicas, LiScript possui palavras reservadas que operam sobre dados ou código, e quando usadas são
compiladas para código JS. Você as invoca envolvendo a chamada com parêntesis, assim como na forma de chamada de
função. A forma de chamada é prefixa, ou seja, o verbo/nome/função sempre vem antes dos argumentos.

Em Lisp, tudo é uma expressão, isto é, cada comando pode ser substituído pelo valor que retorna (se você ignorar os
efeitos secundários, claro).
Infelizmente nem todas as construções LiScript retornam valores porque existem construtos em JS que são declarações,
eles não podem ser usados no lugar de expressões.
As instruções em LiScript que emitem declarações em JS são `return let cond switch while iter continue break try
assert label`. Você pode as usar na maior parte dos lugares no código, ou criar um fechamento se preciso.

### Comentários
Usamos o marcador de comentário tradicional de Lisp:
```
; Isso é uma linha de comentário
(code) ; Tudo do ponto-e-vírgula até o final da linha é ignorado pelo compilador
```

### Palavras reservadas (por categorias)

* Operadores matemáticos: `+ - * / % neg !`
* Comparações lógicas: `and or xor same = != < > <= >= instanceof`
* Operadores de atribuição: `+= -= *= /= %=`
* Operadores bit-a-bit: `<< >> >>> & | ^`
* Atribuição (múltipla): `def let`
* Acessar e manipular membros/propriedades: `get : set := .`
* Condicionais: `if cond switch`
* Funções e fechamentos: `function lambda closure return`
* Tratamento de erros: `throw assert try`
* Instanciar objetos: `new`
* Laços: `while iter continue break`
* Chamadas: `chain fapply`
* Conveniências: `nop quote macro`

### Exemplos de código e explicações das instruções

```
(+ 1 2 3 (* 2 2))
; 1+2+3+(2*2) = 10
(neg 1)
; (-1)

(= 2 2)
; true
(xor true true)
; false

; 'same' é o equivalente de '===' em JS, '=' é o equivalente de '=='

(let a 1) (+= a 1)
; a = 2

(def abc 1 def 2 ghi 3)
; abc=1, def=2, ghi=3 // redefine valores ou cria variáveis globais

(let abc 1 def 2 ghi 3)
; var abc=1, def=2, ghi=3 // define localmente

(console.log (get a 0 1))
; console.log(a[0][1])
(: a 1)
; É o mesmo que '(get a 1)' ou 'a[1]'

(set a 1 2 valor)
; a[1][2] = valor
(:= a "propriedade" 2 valor)
; Mesmo que '(set a "propriedade" 2 valor)' ou 'a["propriedade"][2] = valor'


(let rnd (Math.random))
(if (< rnd 0.5)
    (console.log "Ganhou :D")
    (console.log "Má sorte, tente de novo."))
; Saída: depende do valor de 'rnd'

; 'if' apenas aceita um teste, uma expressão à ser retornada se o teste der verdadeiro e opcionalmente uma expressão
;   para o caso falso.


(cond
    (and (< a 5) (> a 1))  (console.log "Caso 1")
    (and (< a 10) (>= a 5))  (console.log "Caso 2")
    (console.log "N.D.A.") )
; if ((a<5)&&(a>1)) {...} else if ((a>=5)&&(a<10)) {...} else {...}

; 'cond' realiza testes lógicos em sequência, o primeiro que resultar verdadeiro executa o conteúdo do seu braço
; Os testes veem em pares de valor de teste e braço condicional.
; Se um braço vier sobrando no final, ele usa a condição 'else', isto é, executa se todos os testes anteriores falharem.


(let value 1)
(switch value
        1 (console.log "Um")
        2 (console.log "Dois")
        3 (console.log "Três")
        (console.log "N.D.A.") )
; Saída: "Um"

; o 'switch' da LiScript é semelhante ao da JS, mas adaptado para a nova sintaxe.
; Os testes veem em pares de valor de teste e braço condicional. Apenas um executa dependendo do valor.
; Se um braço vier sobrando no final, ele usa a condição 'default'.


(function (a b) (+ a b))
; function (a,b) { return a+b; };
(lambda (+ _ 1))
; function (_) { return _+1 }
(closure (a 1 b 2)
  (return (+ a b)) )
; (function (a,b) { return a+b }) (1,2)

; 'function' cria uma função comum, 'lambda' também mas com um único argumento fixo.
; A última expressão que aparecer no corpo de 'function' ou 'lambda' é automaticamente retornada.
; Se você não quiser retornar um valor, pode usar a instrução '(nop)'.
; 'closure' cria um fechamento, que te permite criar variáveis temporárias. 'closure' não retorna nenhum valor por
;   padrão, já que essa instrução foi pensada para criar escopos.

(throw "Condição insuficiente")
; throw("Condição insuficiente")
(assert (= a 1) "Valor incorreto")
; if(!(a==1)) { throw "Valor incorreto" }

; 'throw' e 'assert' permitem acionar o sistema de excessões de JS.
; 'assert' apenas dispara a excessão se o valor do teste resultar em falso.

(try
  (throw "Teste")
  (console.log _err) )
; try { throw "Teste" } catch (_err) { console.log(_err) }
(try
  (throw "Teste")
  (console.log _err)
  (console.log "Finalize!") )
; try { throw "Teste" } catch (_err) { console.log(_err) } finalize { console.log("Finalize!") }

; 'try' nos permite executar código capturando uma excessão que seja disparada por ele para tratamento.
; Essa instrução aceita por padrão 2 corpos, o de teste e o de tratamento. Opcionalmente você pode passar um terceiro,
;   de finalização.

(let a (new Number "12.34"))
; var a = new Number("12.34")

(let a 1)
(while (<= a 5)
  (console.log a) (+= a 1) )
; Saída: 1 2 3 4 5

(def a 1)
(while :rotulo (<= a 5)
  (console.log a) (break rotulo) (+= a 1) )
; Saída: 1

; 'while' exige um corpo de teste, e um ou mais corpos de instruções. Opcionalmente o primeiro argumento pode ser um
;   símbolo começando em dois-pontos, tal como no exemplo ':rotulo'.
;  Esse símbolo nomeia o laço, permitindo que você o controle usando 'break' e 'continue'. Se você criar vários laços
;   um dentro do outro, 'break' pode pular para fora de vários deles de uma vez com precisão, e 'continue' reinicia
;   a execução do laço nomeado.

; Aliás, o seguinte código é um laço infinito:
(while :rotulo (<= a 5)
  (console.log a) (continue rotulo) (+= a 1) )


(let a [1 2 3 4 5])
(iter indice a
  (console.log (: a indice)) )
; for (indice in a) { console.log(a[indice]) }

; 'iter' usa um laço "for-in" para iterar sobre os membros de um objeto. Essa instrução também aceita um símbolo de
;   rótulo.

; 'continue' e 'break' podem ser usados sem rótulo também:
(break) (continue)


(let
  ; Função fatorial curryficada
  fatorial (function (proc)
    (function (n)
      (if (<= n 1)
        1
        (* n (proc (- n 1))) )))
  ; Combinador Y
  Y (function (exter)
    (let inter (function (proc)
      (let aplica (function (arg)
        (chain proc (proc)(arg)) ))
      (exter aplica) ))
    (inter inter) )
)
(console.log (+ "5! é " (chain Y (fatorial)(5)) ))

; 'chain' nos permite chamar uma função retornando de uma funcão, retornando de uma função...
; Ou seja, o código abaixo:
(chain Y (fatorial)(5))
; Emite na compilação: Y(fatorial)(5)


(let a 1)
(fapply a
  (lambda (* _ 2))
  (lambda (+ _ 1))
  console.log )
; Saída: 3

; 'fapply' aplica sucessivas funções à um objeto inicial, retornando o resultado da última função.
; Cada resultado anterior é passado como argumento para a função seguinte.

(console.log (. "12345"
  (replace "1" "9")
  (replace "4" "-") ))
; console.log( "12345" .replace("1","9") .replace("4","-") )
; Saída: "923-5"

; O operador ponto '.' nos permite acessar propriedades e funções-membro do objeto usando a sintaxe de ponto de JS.
; Se você envolver um nome com parêntesis, estará chamando uma função; se apenas entrar o nome, acessa como propriedade.

(nop)
; Não emite nenhum código, é uma não-operação. Existem lugares onde ela pode ser útil.

(let a (quote (console.log b)) )
(let b 3) (eval a)
(def b 5) (eval a)
; Saída: 3 5
; 'quote' retorna o código compilado dentro de si como uma string. As variáveis não são substituidas, já que esse
;   processo acontece durante a compilação.



; Nenhum dialeto Lisp é completo sem macros!
; Uma macro é uma função especial que permite extender a linguagem original. Você pode criar suas próprias palavras
;   reservadas, que vão se comportar idênticas às originais. Você até pode sobreescrever as palavras originais, desse
;   modo atualizando o compilador!
; Em LiScript, as macros executam durante o tempo de compilação e podem acessar as funções internas do compilador,
;   por isso elas tem poder equivalente às palavras reservadas da linguagem.
; Você só precisa retornar uma string com o resultado em JS, essa string será emitida na compilação quando a macro
;   for invocada.

; Um exemplo prático. ECMA2015 introduziu na JS o protocolo iterable e as funções geradoras.
; As funções geradoras possuem um asterisco antes da lista de argumentos, e podem usar a palavra reservada 'yield'.
; Nosso compilador não pode as emitir sozinho, pois elas tem sintaxe diferenciada. Mas podemos escrever uma macro!
(macro generator (argslist)
  ; 'verify_args' confere se o número de argumentos é válido.
  ; Nesse caso estamos esperando no mínimo 2 parâmetros para nossa macro, sem limite máximo.
  (verify_args "gen" arguments 2 0)
  ; 'is_arguments_list' é uma função de validação de tipo; existem várias para os diferentes tipos de entradas que o
  ;   parser retorna.
  (assert (is_arguments_list argslist)
    ; 'error' aciona o mecanismo interno de erros do compilador, de modo que você fica sabendo a linha no seu código
    ;   onde o erro aconteceu. Seu propósito principal é barrar sintaxe incorreta.
    (error "gen: first argument must be a list"))
  (let body (Array.prototype.slice.call arguments 1 -1))
  (let ret (compile_token (args (- arguments.length 1))))
  ; As macros recebem os tokens diretamente do parser, então é responsabilidade delas compilar o que for necessário.
  ; Você faz isso invocando 'compile_token'.
  (+
    "(function*(" (. (args 0) (map compile_token) (join ",")) ")"
    "{" (. body (map compile_token) (join ";"))
    (if (> ret.length 0) (+ ";return " ret) "") "})")
)

; Desde ECMA2015, 'for-each' é uma construção depreciada, devemos agora usar 'for-of' para iterar valores.
; Perceba que nossa instrução 'iter' emite um laço 'for-in', que itera os índices.
(macro for_of (value object)
  (verify_args "for_of" arguments 3 0)
  (let actions (Array.prototype.slice.call arguments 2))
  (+
    "for(" (compile_token value) " of " (compile_token object) ")"
    "{" (. actions (map compile_token) (join ";")) "}")
)

(let
  ; Uma função geradora muito simples
  a (generator (x)
    (yield x)
    (yield (- x 1)) (nop) )
  ; 'b' agora contém um objeto iterável.
  b (a 8)
)
; Os valores retornados por 'b' são calculados em tempo real pelo conteúdo da função 'a'.
(for_of val b
  (console.log val) )
; Saída: 8 7

```
