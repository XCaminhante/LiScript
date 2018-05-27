(let
  tabela_meses
    [-1 0 31 59 90 120 151 181 212 243 273 304 334]
  tabela_dias_semana
    ["Segunda-feira" "Terça-feira" "Quarta-feira" "Quinta-feira" "Sexta-feira" "Sábado" "Domingo"]
  eh_bissexto (function (ano)
    (and
      (= (% ano 4) 0) (or
        (!= (% ano 100) 0)
        (= (% ano 400) 0) )) )
  validar_data (function (dia mes ano)
    (and
      (and (>= dia 1) (<= dia 31))
      (and (>= mes 1) (<= mes 12))
      (or (!= mes 2) (<= dia (+ 28 (eh_bissexto ano)) )) ))
  dia_semana (function (dia mes ano)
    (assert (validar_data dia mes ano) "Data inválida")
    (+= dia (get tabela_meses mes))
    (-= ano 1)
    (+= dia (+ -1
      (* ano 365)
      (Math.floor (/ ano 4))
      (neg (Math.floor (/ ano 100)))
      (Math.floor (/ ano 400)) ))
    (get tabela_dias_semana (% dia 7)) )
)

(console.log (dia_semana 27 5 2018))
