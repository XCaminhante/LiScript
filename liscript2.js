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
  var spaces = ' \n\t\x0C\u2028\u2029\xA0'
    escape_bar = '\\',
    start_regexp = '#',
    regexp_bar = '/', modes_regex = 'ymgi',
    commentary_start = ';',
    double_quotes = '"',
    open_list = '(', close_list = ')',
    open_array = '[', close_array = ']',
    open_object = '{', close_object = '}',
    end_symbol = spaces
      .concat(start_regexp) .concat(commentary_start) .concat(double_quotes) .concat(open_list)
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

  function read_delimited (start, end, include_escape) {
    skip(start)
    var escape = false, out = ''
    while ((carac = peek())) {
      if (escape) {
        out += carac
        escape = false
      } else if (carac == escape_bar) {
        if (include_escape) out += carac
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

  function read_text () {
    return ['_str', read_delimited(double_quotes,double_quotes,1)]
  }
  function read_regexp () {
    skip('#')
    var body = read_delimited(regexp_bar,regexp_bar)
    var modes = read_while(function (ch) {
      return contained_in(ch, modes_regex)
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
        return read_text()
      case start_regexp:
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
  var parser =  new Liscript_parser(reader)
  this.parser = parser
  function error (msg) {
    parser.error(msg)
  }
  function verify_args (name, args, minimum, maximum, even) {
    if (minimum && maximum && minimum == maximum && args.length != minimum)
      error(name + ': required exactly ' + minimum + ' argument(s)')
    if (minimum && args.length < minimum)
      error(name + ': insufficient arguments')
    if (maximum && args.length > maximum)
      error(name + ': excessive arguments')
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
  function is_functional (obj) { return (obj instanceof Array) && (obj[0] === 'lam' || obj[0] === 'fun') }
  function is_lambda (obj) { return (obj instanceof Array) && obj[0] === 'lam' }
  function is_function (obj) { return (obj instanceof Array) && obj[0] === 'fun' }
  function is_arguments_list (list) {
    return (list instanceof Array) &&
      list.every(function (val, idx) {
        return is_symbol(val)
      })
  }
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
    'fun': function (args) {
      verify_args('fun',args,2,0)
      if (!is_arguments_list(args[0]))
        error('fun: invalid arguments list')
      var ret = compile_token(args[args.length-1])
      return '(function(' + args[0].map(compile_token).join(',') + ')' +
        '{' + args.slice(1,-1).map(compile_token).join(';') +
        (ret.length>0?';return ' + ret:'') + '})'
    },
    'lam': function (args) {
      verify_args('lam',args,1,0)
      return '(function(_){' +
        args.slice(0,-1).map(compile_token).join(';') +
        ';return ' + compile_token(args[args.length-1]) + '})'
    },
    'ret': function (args) {
      verify_args('ret',args,1,1)
      return '{return ' + compile_token(args[0]) + '}'
    },
    'ifret': function (args) {
      verify_args('ret',args,2,2)
      return '{if(' + compile_token(args[0]) + ')return ' + compile_token(args[1]) + '}'
    },
    'set': function (args) {
      verify_args('set',args,3,0)
      return '(' + compile_token(args[0]) + '[' +
        args.slice(1,-1).map(compile_token).join('][') + ']=' +
        compile_token(args[args.length-1]) + ')'
    },
    'get': function (args) {
      verify_args('get',args,2,0)
      return '(' + compile_token(args[0]) +
      '[' + args.slice(1).map(compile_token).join('][') + '])'
    },
    'def': function (args) {
      verify_args('def',args,2,0,1)
      var ret = '('
      for (var a = 0; a < args.length; a += 2) {
        ret += compile_token(args[a]) + '=' + compile_token(args[a+1]) + ','
      }
      ret = ret.slice(0,-1) + ')'
      return ret
    },
    'let': function (args) {
      verify_args('let',args,2,0,1)
      return builtins['def'](args)
        .replace(/^\(/g,'{var ')
        .replace(/\)$/g,'}')
    },
    'if': function (args) {
      verify_args('if',args,2,3)
      return '(' + compile_token(args[0]) +
        '?' + compile_token(args[1]) +
        ':' + (args.length==3? compile_token(args[2]): 'null') + ')'
    },
    'cond': function (args) {
      verify_args('cond',args,2,0)
      var ret = '(function(){'
      for (var a = 0; a < args.length-1; a+=2) {
        ret += (a>0?'else if(':'if(') + compile_token(args[a]) + '){' + compile_token(args[a+1]) + '}'
      }
      if (args.length % 2 != 0) {
        ret += 'else{' + compile_token(args[args.length-1]) + '}'
      }
      ret += '})()'
      return ret
    },
    'switch': function (args) {
      verify_args('switch',args,3,0)
      var ret = '(function(_){switch(_){'
      for (var a = 1; a < args.length-1; a+=2) {
        ret += 'case ' + compile_token(args[a]) + ':' +
          compile_token(args[a+1]) + ';break;'
      }
      if (args.length % 2 == 0) {
        ret += 'default:' + compile_token(args[args.length-1])
      }
      ret += '}})(' + compile_token(args[0]) + ')'
      return ret
    },
    'while': function (args) {
      verify_args('while',args,3,4)
      return '(function(){' + compile_token(args[0]) +
        ';while(' + compile_token(args[1]) + '){' +
        compile_token(args[2]) + '}' +
        (args.length==4? compile_token(args[3]) :'') + '})()'
    },
    'iter': function (args) {
      verify_args('iter',args,2,3)
      return '(function(obj_){for(var key in obj_){var val=obj_[key];' + compile_token(args[1]) +
        '}' + (args.length==3? 'return ' + compile_token(args[2]) :'') +
        '})(' + compile_token(args[0]) + ')'
    },
    'try': function (args) {
      verify_args('try',args,2,3)
      return '(function(){try{' +
        compile_token(args[0]) +
        '}catch(_){' + compile_token(args[1]) + '}' +
        (args.length==3?'finally{' + compile_token(args[2]) + '}':'') + '})()'
    },
    'throw': function (args) {
      verify_args('throw',args,1,1)
      return '{throw ' + compile_token(args[0]) + '}'
    },
    'Error': function (args) {
      verify_args('error',args,1,3)
      return '{throw Error(' + args.map(compile_token).join(',') + ')}'
    },
    'TypeError': function (args) {
      verify_args('type_error',args,1,3)
      return '{throw TypeError(' + args.map(compile_token).join(',') + ')}'
    },
    'assert': function (args) {
      verify_args('assert',args,2,2)
      return '{if(!(' + compile_token(args[0]) + '))throw ' + compile_token(args[1]) + '}'
    },
    'new': function (args) {
      verify_args('new',args,1,0)
      if (!is_symbol(args[0]))
        error('new: first argument must be a symbol')
      return '(new ' + args[0] +
        '(' + args.slice(1).map(compile_token).join(',') + '))'
    },
    'chain': function (args) {
      verify_args('chain',args,2,0)
      var ret = '(' + compile_token(args[0]) + '(' +
        args.slice(1).map(function(item) {
          if (!is_list(item))
            error('chain: all arguments after first must be lists')
          return item.map(compile_token).join(',')
        }).join(')(')
      ret += '))'
      return ret
    },
    'fapply': function (args) {
      verify_args('fapply',args,2,0)
      var ret = '(' + compile_token(args[0]) + ')'
      args.slice(1).map(function(item){
        if (!is_symbol(item) && !is_functional(item))
          error('fapply: all arguments after first must be symbols or function objects')
        ret = '(' + compile_token(item) + ret + ')'
      })
      return ret
    },
    '.': function (args) {
      verify_args('.',args,2,0)
      return '(' + compile_token(args[0]) + '.' +
        args.slice(1)
        .map(compile_token)
        .map(function (a) {return a.replace(/^\(|\)$/g,'')})
        .join('.') + ')'
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
    'block': function (args) {
      verify_args('block',args,1,0)
      return '{' + args.map(compile_token).join(';') + '}'
    },
    'nop':function (args) {
      return ''
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
      verify_args('macro',args,2,0)
      if (!is_symbol(args[0]))
        error('macro: first argument must be a symbol')
      if (!is_arguments_list(args[1]))
        error('macro: second argument must be a list')
      var ret = compile_token(args[args.length-1])
      var func = 'new Function("' + args[1].join('","') + '","' +
        escape_double_quotes(args.slice(2,-1).map(compile_token).join(';')) +
        escape_double_quotes(';return ' + ret) +
        '")'
      macros[args[0]] = eval(func)
      return ''
    }
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
    if (is_number(token[0]) || is_string(token[0]) || is_array(token[0]) || is_object(token[0]))
      error('<function_call>: invalid token')
    if (macros[token[0]]) {
      return macros[token[0]].apply(this, token.slice(1).map(
        function (item) {return eval(compile_token(item))}
      ))
    }
    return '(' + token[0] + '(' + token.slice(1).map(compile_token).join(',') + '))'
  }
  function compile_token (token) {
    if ((token instanceof Array) && token.length > 0) {
      if (builtins[token[0]] && builtins.hasOwnProperty(token[0])) {
        return builtins[token[0]]( token.slice(1) )
      }
      return function_call(token)
    }
    return token
  }
  function compile_all () {
    var out = '', token
    while( (token = this.parser.read_token()) ) {
      out += compile_token(token) + ';'
    }
    out = out
      .replace(/{;/g,'{')
      .replace(/return \(/g,'return(')
      .replace(/;}/g,'}')
      .replace(/! \(/g,'!(')
    return out + '\n'
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
