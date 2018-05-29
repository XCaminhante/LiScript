Reader_plain_text = function (text) {
  this.column = 1
  this.line = 1
  this.pos = 0
  this.text = text
}

Reader_plain_text.prototype = {
  peek: function () {
    if (this.text && this.pos < this.text.length)
      return this.text[this.pos]
    return null
  },
  next: function () {
    if (this.text && this.pos < this.text.length-1) {
      this.pos ++
      if (this.text[this.pos] == 10) {
        this.line ++
        this.column = 1
      } else {
        this.column ++
      }
      return this.text[this.pos]
    }
    if (this.text) this.pos = this.text.length
    return null
  },
  reset: function () {
    this.column = 1
    this.line = 1
    this.pos = 0
  },
  toString: function () {
    return '<Text ' + this.text.length + ' chars>'
  },
}

Liscript_parser = function (reader) {
  var spaces = ' \n\t\x0C\u2028\u2029\xA0',
    escape_bar = '\\',
    regexp_start = '/',
    regexp_bar = '/', regexp_modes = 'ymgiu',
    commentary_start = ';',
    simple_quotes = "'",
    double_quotes = '"',
    open_list = '(', close_list = ')',
    open_array = '[', close_array = ']',
    open_object = '{', close_object = '}',
    end_symbol = spaces
      .concat(regexp_start) .concat(commentary_start) .concat(double_quotes) .concat(open_list)
      .concat(close_list) .concat(open_array) .concat(close_array) .concat(open_object) .concat(close_object)
  this.def_reader = function (new_reader) {
    reader = new_reader
  }
  function peek () {
    return reader.peek()
  }
  function next () {
    return reader.next()
  }
  function reset () {
    reader.reset()
  }
  function error (msg) {
    throw new Error('At ' + reader.toString() +
      ', line ' + reader.line +
      ' column ' + reader.column + ': ' +
      msg)
  }
  function contained_in (carac, conj) {
    return conj.indexOf(carac) != -1
  }
  function read_while (allow_it) {
    var buf = '', carac = peek()
    while (carac && allow_it(carac)) {
      buf += carac
      carac = next()
    }
    return buf
  }

  function skip_space () {
    read_while(function (ch) {
      return contained_in(ch, spaces)
    })
  }
  function skip_commentary () {
    read_while(function (ch) {
      return ch.charCodeAt(0) != 10
    })
  }
  function skip (waiting) {
    if (peek() != waiting)
      error('Expected ' + waiting.charCodeAt(0) + ' ' + waiting)
    next()
  }

  function read_delimited (start, end, dont_skip_start) {
    var escape = false, out = ''
    if (!dont_skip_start) skip(start)
    while ((carac = peek())) {
      if (escape) {
        out += carac
        escape = false
      } else if (carac == escape_bar) {
        out += carac
        escape = true
      } else if (carac == end) {
        break
      } else {
        out += carac
      }
      if (next() == null)
        error('Interrupted reading (EOF)')
    }
    next()
    return out
  }

  function read_nested (start, end) {
    var tokens = []
    skip(start)
    ext: while (true) {
      skip_space()
      switch (peek()) {
      case end:
      case null:
        break ext
      case commentary_start:
        skip_commentary()
        continue ext
      default:
        tokens.push(read_token())
      }
    }
    skip(end)
    return tokens
  }

  function read_text (quotes) {
    return ['_str', read_delimited(quotes,quotes)]
  }
  function read_regexp () {
    var ch = next()
    if (end_symbol.indexOf(ch) != -1) {
      return '/'
    }
    var body = read_delimited(ch,regexp_bar,1)
    var modes = read_while(function (ch) {
      return contained_in(ch, regexp_modes)
    })
    return new RegExp( body, modes )
  }

  function read_atom () {
    var ret = read_while(function (ch) {
      return !contained_in(ch, end_symbol)
    })
    var maybe_a_number = ret.length > 0 && /^-?[0-9]*\.?[0-9]*e?[0-9]*$/.test(ret)
    if (maybe_a_number) {
      var number = parseFloat(ret)
      if (! isNaN(number))
        return number
    }
    if (ret == '__LINE')
      return reader.line
    if (ret == '__COLUMN')
      return reader.column - '__COLUMN'.length
    return ret
  }
  function read_token () {
    var tmp
    ext: while (true) {
      skip_space()
      switch (peek()) {
      case commentary_start:
        skip_commentary()
        continue ext
      case double_quotes:
      case simple_quotes:
        return read_text(peek())
      case regexp_start:
        return read_regexp()
      case open_list:
        return read_nested(open_list, close_list)
      case open_array:
        tmp = read_nested(open_array, close_array)
        tmp.unshift('_arr')
        return tmp
      case open_object:
        tmp = read_nested(open_object, close_object)
        tmp.unshift('_obj')
        return tmp
      case close_list:
        error('Parenthesis pair open')
      case close_array:
        error('Square brackets pair open')
      case close_object:
        error('Curly brackets pair open')
      case null:
        return null
      }
      return read_atom()
    }
  }
  this.read_token = read_token
  this.read_atom = read_atom
  this.error = error
  this.reset = reset
}



Liscript_compiler = function (reader) {
  var parser = new Liscript_parser(reader)
  this.parser = parser
  function error (msg) {
    parser.error(msg)
  }
  function verify_args (name, args, minimum, maximum, even) {
    if (minimum && maximum && minimum == maximum && args.length != minimum) {
      error(name + ': required exactly ' + minimum + ' argument(s)')
    } else {
    if (minimum && args.length < minimum)
      error(name + ': insufficient arguments')
    if (maximum && args.length > maximum)
      error(name + ': excessive arguments')
    }
    if (even && args.length % 2 != 0)
      error(name + ': arguments number must be even')
  }
  function escape_double_quotes (text) {
    return text
      .replace(/^\"|([^\\])"/g,'$1\\"')
      .replace(/\\""/g,'\\"\\"')
  }
  function is_symbol (obj) { return typeof(obj) == 'string' }
  function is_string (obj) { return (obj instanceof Array) && obj[0] === '_str' }
  function is_number (obj) { return (typeof(obj) == 'number') }
  function is_list (obj) { return (obj instanceof Array) }
  function is_array (obj) { return (obj instanceof Array) && obj[0] === '_arr' }
  function is_object (obj) { return (obj instanceof Array) && obj[0] === '_obj' }
  function is_functional (obj) { return (obj instanceof Array) && ( functionals.indexOf(obj[0]) != -1 ) }
  function is_arguments_list (list) {
    return (list instanceof Array) &&
      list.every(function (val, idx) {
        return is_symbol(val)
      })
  }
  var functionals = ['function','lambda','closure']
  var builtins = {
    '_str': function (args) {
      return '"' + args.map(escape_double_quotes).join(' ') + '"'
    },
    '_arr': function (args) {
      return '[' + args.map(compile_token).join(',') + ']'
    },
    '_obj': function (args) {
      verify_args('_obj',args,0,0,1)
      var ret = '{'
      for (var a = 0; a < args.length; a += 2) {
        if (!is_symbol(args[a]) && !is_string(args[a]) && !is_number(args[a]))
          error('_obj: key must be a symbol, string or a number')
        ret += compile_token(args[a]) + ':' + compile_token(args[a+1]) + ','
      }
      ret += '}'
      return ret.replace(/,\}$/g,'}')
    },
    'function': function (args) {
      verify_args('function',args,2,0)
      if (!is_arguments_list(args[0]))
        error('function: invalid arguments list')
      var ret = compile_token(args[args.length-1])
      return '(function(' + args[0].map(compile_token).join(',') + '){' +
        args.slice(1,-1).map(compile_token).join(';') +
        (ret.length>0? ';return ' + ret :'') + '})'
    },
    'lambda': function (args) {
      verify_args('lambda',args,1,0)
      var ret = compile_token(args[args.length-1])
      return '(function(_){' +
        args.slice(0,-1).map(compile_token).join(';') +
        (ret.length>0? ';return ' + ret :'') + '})'
    },
    'closure': function (args) {
      verify_args('closure',args,2,0)
      if (!is_list(args[0]))
        error('closure: invalid arguments list')
      if (args[0].length%2 != 0)
        error('closure: arguments list items number must be even')
      return '(function(' +
        args[0].filter(function(val,idx){
          return (idx%2 == 0 &&
            ( is_symbol(val) || error('closure: invalid argument name') ))
        }).join(',') + '){' +
        args.slice(1).map(compile_token).join(';') +
        '})(' + args[0].filter(function(val,idx){
          return (idx%2 == 1)
        }).map(compile_token).join(',') + ')'
    },
    'return': function (args) {
      verify_args('return',args,1,1)
      return 'return ' + compile_token(args[0])
    },
    'set': function (args) {
      verify_args('set',args,3,0)
      args = args.map(compile_token)
      return '(' + args[0] + '[' +
        args.slice(1,-1).join('][') + ']=' +
        args[args.length-1] + ')'
    },
    ':=': function (args) {
      return this['set'](args)
    },
    'get': function (args) {
      verify_args('get',args,2,0)
      args = args.map(compile_token)
      return '(' + args[0] +
      '[' + args.slice(1).join('][') + '])'
    },
    ':': function (args) {
      return this['get'](args)
    },
    'def': function (args) {
      verify_args('def',args,2,0,1)
      args = args.map(compile_token)
      return '(' + args.map(function(val,idx){
        return val + (idx%2? ',' :'=')
      }).join('').slice(0,-1) + ')'
    },
    '.': function (args) {
      verify_args('.',args,2,0)
      return '(' + compile_token(args[0]) +
        args.slice(1)
        .map(function(item){
          var ret = ''
          if (is_array(item)) {
            for (var a = 1; a < item.length; a++) {
              ret += '[' + compile_token(item[a]) + ']'
            }
          } else {
            ret = '.' + compile_token(item)
          }
          return ret
        })
        .join('') + ')'
    },
    'let': function (args) {
      verify_args('let',args,2,0,1)
      args = args.map(compile_token)
      return '{var ' + args.map(function(val,idx){
        return val + (idx%2? ',' :'=')
      }).join('').slice(0,-1) + '}'
    },
    'if': function (args) {
      verify_args('if',args,2,3)
      args = args.map(compile_token)
      return '(' + args[0] +
        '?' + args[1] +
        ':' + (args.length==3? args[2]: 'null') + ')'
    },
    'cond': function (args) {
      verify_args('cond',args,2,0)
      return args.map(compile_token).map(function(val,idx){
        if (idx%2==0) {
          if (idx==args.length-1) return 'else{' + val + '}'
          return (idx>0?'else ':'') + 'if(' + val + ')'
        }
        return '{' + val + '}'
      }).join('')
    },
    'switch': function (args) {
      verify_args('switch',args,3,0)
      args = args.map(compile_token)
      return 'switch(' + args[0] + '){' +
        args.slice(1).map(function(val,idx){
          if (idx%2==0) {
            if (idx==args.length-2) return 'default:' + val
            return 'case ' + val + ':'
          }
          return val.join(';') + ';break;'
        }).join('') + '}'
    },
    'while': function (args) {
      verify_args('while',args,2,0)
      args = args.map(compile_token)
      var label = (args.length>2 && args[0][0]==':' ? args.shift().slice(1)+':' : '')
      return label +
        'while(' + args[0] + ')' +
        '{' + args.slice(1).join(';') + '}'
    },
    'iter': function (args) {
      verify_args('iter',args,3,0)
      args = args.map(compile_token)
      var label = (args.length>3 && args[0][0]==':' ? args.shift().slice(1)+':' : '')
      return label +
        'for(' + args[0] + ' in ' + args[1] + ')' +
        '{' + args.slice(2).join(';') + '}'
    },
    'continue': function (args) {
      verify_args('continue',args,0,1)
      if (args.length == 0)
        return 'continue'
      if (!is_symbol(args[0])) error('continue: first argument must be a symbol')
      return 'continue ' + args[0]
    },
    'break': function (args) {
      verify_args('break',args,0,1)
      if (args.length == 0)
        return 'break'
      if (!is_symbol(args[0])) error('break: first argument must be a symbol')
      return 'break ' + args[0]
    },
    'try': function (args) {
      verify_args('try',args,2,3)
      args = args.map(compile_token)
      return 'try{' + args[0] + '}' +
        'catch(_err){' + args[1] + '}' +
        (args.length==3?'finally{' + args[2] + '}':'')
    },
    'throw': function (args) {
      verify_args('throw',args,1,1)
      return 'throw ' + compile_token(args[0]) + ''
    },
    'assert': function (args) {
      verify_args('assert',args,2,2)
      args = args.map(compile_token)
      return 'if(!(' + args[0] + '))throw ' + args[1]
    },
    'new': function (args) {
      verify_args('new',args,1,0)
      args = args.map(compile_token)
      return '(new ' + args[0] + '(' + args.slice(1).join(',') + '))'
    },
    'chain': function (args) {
      verify_args('chain',args,2,0)
      return '(' + compile_token(args[0]) + '(' +
        args.slice(1).map(function(item) {
          if (!is_list(item))
            error('chain: all arguments after first must be lists')
          return item.map(compile_token).join(',')
        }).join(')(') + '))'
    },
    'fapply': function (args) {
      verify_args('fapply',args,2,0)
      var ret = '(' + compile_token(args[0]) + ')'
      args.slice(1).map(function(item){
        if (!is_symbol(item) && !is_functional(item)) {
          println(item)
          error('fapply: all arguments after first must be symbols or function objects')
        }
        ret = '(' + compile_token(item) + ret + ')'
      })
      return ret
    },
    'instanceof': function (args) {
      verify_args('instanceof',args,2,2)
      if (!is_symbol(args[1]))
        error('instanceof: second argument must be a symbol')
      return '(' + compile_token(args[0]) + ' instanceof ' + compile_token(args[1]) + ')'
    },
    'xor': function (args) {
      verify_args('xor',args,2,0)
      return '(' + args.map(compile_token).map(function(a){
        return '(!!' + a + ')'
      }).join('^') + ')'
    },
    'args': function (args) {
      verify_args('args',args,1,1)
      var selec = compile_token(args[0])
      return '(arguments.length>' + selec + '?arguments[' + selec + ']:undefined)'
    },
    'nop':function (args) {
      return ''
    },
    'stmt': function (args) {
      args = args.map(compile_token)
      return '{' + args.join(';') + '}'
    },
    'neg': function (args) {
      verify_args('neg',args,1,1)
      return '(-' + compile_token(args[0]) + ')'
    },
    '!': function (args) {
      verify_args('!',args,1,1)
      return '(! ' + compile_token(args[0]) + ')'
    },
    'macro': function (args) {
      verify_args('macro',args,3,0)
      if (!is_symbol(args[0]))
        error('macro: first argument must be a symbol')
      if (!is_arguments_list(args[1]))
        error('macro: second argument must be a list')
      var ret = compile_token(args[args.length-1])
      var func = 'func = function(' + args[1].join(',') + '){' +
        args.slice(2,-1).map(compile_token).join(';') +
        (ret.length>0? ';return ' + ret :'') + '}'
      macros[args[0]] = eval(func)
      return ''
    },
    'quote': function (args) {
      return '"' + escape_double_quotes(
        args.map(compile_token).join(',').replace(/\\/g,'\\\\\\')
        ) + '"'
    },
  }
  var infix_operators = {
    'and':'&&',
    'or':'||',
    '=':'==',
    'same':'===',
    '!=':'!=',

    '+':'+',
    '-':'-',
    '*':'*',
    '/':'/',
    '%':'%',

    '+=':'+=',
    '-=':'-=',
    '*=':'*=',
    '/=':'/=',
    '%=':'%=',

    '<':'<',
    '>':'>',
    '<=':'<=',
    '>=':'>=',

    '<<':'<<',
    '>>':'>>',
    '>>>':'>>>',
    '&':'&',
    '|':'|',
    '^':'^',

    'do':',',
  }
  var macros = {}
  for (var oper in infix_operators) {(function(op){
    builtins[op] = function (args) {
      verify_args(op,args,2,0)
      return '(' + args.map(compile_token).join(infix_operators[op]) + ')'
    }
  })(oper)}
  function function_call (token) {
    if (macros[token[0]]) {
      return macros[token[0]].apply(this, token.slice(1))
    }
    return '(' + compile_token(token[0]) + '(' + token.slice(1).map(compile_token).join(',') + '))'
  }
  function compile_token (token) {
    if ((token instanceof Array) && token.length > 0) {
      if (builtins[token[0]] && builtins.hasOwnProperty(token[0])) {
        return builtins[token[0]]( token.slice(1) )
      }
      return function_call(token)
    }
    return token.toString()
  }
  function compile_all () {
    var out = '', token
    while( (token = this.parser.read_token()) ) {
      out += compile_token(token) + ';'
    }
    return out
      .replace(/{;/g,'{')
      .replace(/;}/g,'}')
      .replace(/ \(/g,'(')
      .replace(/\) /g,')')
      .replace(/;;/g,';') +
      '\n'
  }
  this.builtins = builtins
  this.compile_all = compile_all
  this.compile_token = compile_token
  this.verify_args = verify_args
  this.error = error
  this.is_symbol = is_symbol
  this.is_string = is_string
  this.is_number = is_number
  this.is_list = is_list
  this.is_array = is_array
  this.is_object = is_object
  this.is_arguments_list = is_arguments_list
}

module.exports = {
  "Reader_plain_text": Reader_plain_text,
  "parser": Liscript_parser,
  "compiler": Liscript_compiler,
}
