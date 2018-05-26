var fs = require('fs'),
    liscript = require('./liscript2')

function erro (msg) {
  process.stderr.write(msg + '\n')
  process.exit(1)
}

if (process.argv.length <= 2) {
  erro('Uso: node compilar_liscript.js arq1.lisp [arq2.lisp ... arqN.lisp]')
}

var compilador = new liscript.compiler()

for (var a = 2; a < process.argv.length; a++) {
  var nome_entrada = process.argv[a],
      nome_saida = nome_entrada .replace(/.lisp$/,'') + '.js'
  try { fs.accessSync(nome_entrada, fs.constants.R_OK) }
  catch (_) { erro(nome_entrada + ' não está acessível') }
  if (! fs.statSync(nome_entrada).isFile())
    erro(nome_entrada + ' não é arquivo')
  try { fs.unlinkSync(nome_saida) } catch (_) {}
  var programa = fs.readFileSync(nome_entrada,'utf8')
  compilador.parser.def_reader(new Reader_plain_text(programa))
  var resultado = compilador.compile_all()
  fs.writeFileSync(nome_saida, resultado)
  console.log(nome_saida + ': ' + resultado.length + ' bytes')
}
