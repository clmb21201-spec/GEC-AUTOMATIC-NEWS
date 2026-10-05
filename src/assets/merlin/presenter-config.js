'use strict';
// Configuración del presentador Merlín (exportada desde la página "Merlín en el set" y ampliada).
// Si vuelves a pegar el texto de "Valores para Claude Code", conserva las secciones subtitulos, reloj, titulares, volumen, expresion, gestos y camaras.parallax.
// Debe quedar: window.MERLIN_CONFIG = { ... };
window.MERLIN_CONFIG = {
  "modelo": "MERLIN1_CORREGIDO.glb (pesos del pico/ojos en CUERPO pasados a CABEZA)",
  "rotacion": "grados, relativos a la pose de reposo: bone.quaternion = rest * Euler(x,y,z, orden ZYX)",
  "lipSync": {
    "hueso": "BOCA_INF",
    "eje": "x",
    "cerrado": 0,
    "abiertoMax": -30,
    "sensibilidad": 11.5,
    "umbralRMS": 0.012,
    "cierrePorSegundo": 12,
    "aperturaPorSegundo": 35,
    "picoSuperior": {
      "hueso": "BOCA_SUP",
      "eje": "x",
      "factor": 0.35,
      "signo": "+"
    }
  },
  "parpadeo": {
    "hueso": "PARPADOS_MAYA",
    "eje": "x",
    "abierto": 0,
    "cerrado": 121,
    "cadaSegundos": [
      3,
      6
    ],
    "duracionMs": 160
  },
  "ojos": {
    "huesos": [
      "OJO_R",
      "OJO_L"
    ],
    "ejeVertical": "x (+ abajo)",
    "ejeHorizontal": "z"
  },
  "cabeza": {
    "hueso": "CABEZA",
    "asentir": "x",
    "girar": "y",
    "inclinar": "z",
    "acompanaAlHablar": 0
  },
  "columna": {
    "hueso": "COLUMNA",
    "respiracion": "x"
  },
  "alas": {
    "alHablar": {
      "intensidad": 1.15,
      "subir": "hasta ~10° + gesto de 12° en acentos (35% de probabilidad)",
      "adelante": "eje X +, hasta ~7° + gesto 10°",
      "energia": "mouth suavizado (sube 2.5/s, baja 0.8/s)"
    },
    "nota": "reparentar ALA_SUP_R y ALA_SUP_L a COLUMNA con attach() al cargar y recapturar su rotación de reposo",
    "bajar": {
      "ALA_SUP_R": {
        "eje": "z",
        "grados": -60
      },
      "ALA_SUP_L": {
        "eje": "z",
        "grados": 60
      }
    }
  },
  "escena": {
    "capas": [
      "FONDO_SET",
      "SILLA",
      "Merlín (canvas transparente)",
      "MESA",
      "MICROFONO",
      "vasos"
    ],
    "camara": {
      "fov": 26,
      "posicion": [
        0,
        1.4,
        3.4
      ],
      "mira": [
        0,
        0.45,
        0
      ]
    },
    "merlin": {
      "x": -0.17,
      "y": 0.07,
      "escala": 1.07,
      "giroY": 33,
      "cabezaMiraCamara": 0.75
    },
    "sombraSilla": 0.2,
    "silla": {
      "escala": 0.52,
      "centroX": 0.43,
      "bordeSuperiorY": 0.35,
      "nota": "fracciones del ancho/alto del cuadro; capa original centro X 0.5286, borde superior 0.1151"
    },
    "microfono": {
      "escala": 0.46,
      "baseX": 0.146,
      "baseY": 0.716,
      "rotacion": -0.5,
      "nota": "ancla = base del brazo, en la capa en (0.125, 0.70)"
    },
    "vasos": {
      "escala": 0.27,
      "x": 0.206,
      "y": 0.83,
      "nota": "ancla = centro inferior, en la capa en (0.499, 0.793)"
    }
  },
  "camaras": {
    "planos": [
      {
        "nombre": "General",
        "zoom": 1.1,
        "desplazX": -0.07,
        "desplazY": -0.03,
        "centradoEnCabeza": false
      },
      {
        "nombre": "Medio",
        "zoom": 1.45,
        "desplazX": 0.11,
        "desplazY": -0.03,
        "centradoEnCabeza": true
      },
      {
        "nombre": "Primer plano",
        "zoom": 2.2,
        "desplazX": 0,
        "desplazY": -0.07,
        "centradoEnCabeza": true
      }
    ],
    "direccionAutomatica": true,
    "alternanciaSeg": 12,
    "planoMedioMerlinX": 0.3,
    "usoPorSegmento": {
      "presentacion": "General",
      "regresoDeEnlatadoOAnuncio": "General",
      "noticia": "Medio con Merlín a la izquierda (x en pantalla 0.3) y recuadro de imagen a la derecha; alterna recuadro y pantalla completa cada 12 s",
      "despedidaOPaseACorte": "Primer plano"
    },
    "nota": "EC1 debe enviar con cada audio el tipo de segmento: intro | news | return | outro, más la imagen y el titular en las noticias",
    "transicion": "smooth",
    "acercamientoLento": "+4% durante el plano",
    "metodo": "CSS transform (translate+scale) en las capas de atrás y de adelante; el 3D usa camera.setViewOffset con el mismo recorte",
    "planoMedioCentradoAuto": true,
    "parallax": {
      "activo": true,
      "fondo": 0.88,
      "silla": 0.96,
      "mesa": 1.04,
      "objetos": 1.08,
      "nota": "1 = profundidad de Merlín; menos de 1 se mueve menos (más lejos), más de 1 se mueve más (más cerca)"
    }
  },
  "imagenApoyo": {
    "cuadroPared": {
      "activo": false,
      "esquinas": [
        [
          0.7602,
          0.2
        ],
        [
          0.9025,
          0.2063
        ],
        [
          0.8984,
          0.3914
        ],
        [
          0.7548,
          0.3799
        ]
      ],
      "capa": "detrás de la silla, se mueve con las cámaras"
    },
    "tablet": {
      "activo": false,
      "esquinas": [
        [
          0.8194,
          0.5395
        ],
        [
          0.8678,
          0.4951
        ],
        [
          0.9087,
          0.6382
        ],
        [
          0.8585,
          0.6908
        ]
      ],
      "capa": "sobre la mesa"
    },
    "grande": "ots",
    "recuadro": {
      "lado": "right",
      "anchoMax": 0.44,
      "desplazX": -0.01,
      "top": 0.235,
      "aspecto": "16:9",
      "regla": "se ubica en el lado opuesto a la cabeza de Merlín (proyección del hueso CABEZA), separado 0.13×escala; ancho mínimo 22%",
      "animacion": "entra deslizándose + zoom lento"
    },
    "pantallaCompleta": "fundido + zoom lento",
    "zocalo": {
      "planoMedio": "solo p.title en cintillo centrado de 90% de ancho (left/right 5%, bottom 6%), alto fijo de 2 renglones, padding 28/48px, máx. 2 líneas (50px@1920, peso 900, fondo lowerBg, borde izquierdo categoryBg)",
      "pantallaCompleta": "réplica del #lower de EC1: shade + metaRow (p.category, p.pubDate, p.isExclusive) + p.title 70px + p.summary 34px, colores y tipografías de design"
    },
    "datosDeEC1": {
      "evento": "output:story",
      "kind": "news | canned | ad",
      "campos": {
        "imagen": "p.image || p.fallbackImage",
        "titular": "p.title",
        "bajada": "p.summary",
        "categoria": "p.category",
        "fecha": "p.pubDate || p.date",
        "exclusivo": "p.isExclusive",
        "audio": "p.audioUrl"
      },
      "diseno": "output:design (fontFamily, titleColor, summaryColor, dateColor, categoryBgColor, categoryTextColor, lowerBgColor, lowerOpacity, tamaños y pesos de output-0324)",
      "segmentos": "EC1 hoy solo tiene news, canned y ad. Presentación y despedida serían tipos nuevos; el regreso se detecta cuando llega una news después de un canned o ad (plano general al inicio).",
      "conexion": "la página puede escuchar el mismo EventSource /events del servidor LAN de EC1 (output-web-adapter.js), igual que output-web.html"
    },
    "ejemplo": {
      "titular": "Golpe de estado hemor perdido la autonomía del poder",
      "bajada": "ES HORA DE REZAR POQUE DE AQUI EN ADELANTE YA NO HABRÁ SALVACIÓN",
      "categoria": "ACTUALIDAD",
      "fecha": "",
      "exclusivo": true
    },
    "alternarEnNoticias": true,
    "nota": "mapeo en perspectiva con CSS matrix3d desde 4 esquinas; EC1 enviaría la URL de la imagen y el titular de cada noticia por WebSocket"
  },
  "vida": {
    "parpadeo": true,
    "miradas": true,
    "balanceoCabeza": true,
    "respiracion": true,
    "alasIndependientes": true
  },
  "integracion": {
    "entornoDesdeFoto": true,
    "reboteMesa": {
      "color": "#d98a45",
      "intensidad": 0.9,
      "desde": [
        0,
        -1.5,
        2
      ]
    },
    "sombraMesa": {
      "intensidad": 0.48,
      "lineaMesaPantallaY": 0.64,
      "nota": "oscurece fragmentos con Y de mundo cerca del borde de la mesa (onBeforeCompile)"
    },
    "plumas": {
      "normalMapRuido": true,
      "repeticion": 10,
      "intensidad": 0.15
    },
    "blancoCalido": 0.2,
    "filtroCSS": "sepia(0.08) saturate(0.84) contrast(1.08) blur(0.4px)",
    "grano": 0.02,
    "materiales": "MeshPhysicalMaterial respetando rugosidad/metalizado de Blender; MERLIN y ALAS PLUMAS: sheen 0.5/0.4 + normal de plumas; SOMBRERO sheen 0.4; LENTES y OJO clearcoat; metalizado del cuerpo = slider"
  },
  "iluminacion": {
    "toneMapping": "ACESFilmic",
    "exposicion": 0.8,
    "luzPrincipal": 1.15,
    "colorPrincipal": "#ffe4c4 desde arriba-derecha",
    "lampara": "#ffc870 0.35 desde izquierda",
    "relleno": 0.5,
    "contraluz": 0.6,
    "reflejosEntorno": 0.8,
    "metalizado": 0.3
  },
  "ajusteManual": {
    "BOCA_INF": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "BOCA_SUP": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "PARPADOS_MAYA": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "OJO_R": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "OJO_L": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "CABEZA": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "COLUMNA": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "ALA_SUP_R": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "ALA_SUP_L": {
      "x": 0,
      "y": 0,
      "z": 0
    }
  },
  "subtitulos": {
    "activos": true,
    "nota": "texto exacto del guion (p.script); tiempos estimados por largo de frase"
  },
  "reloj": {
    "activo": true,
    "posicion": "derecha"
  },
  "titulares": {
    "cadaMinutos": 25,
    "cantidad": 3
  },
  "volumen": {
    "objetivoDb": -20,
    "nota": "nivel RMS de la voz (tramos con voz) al que se normaliza; ganancia limitada a -12..+6 dB"
  },
  "expresion": {
    "cejas": {
      "eje": "x",
      "amplitud": -18,
      "nota": "en este rig, girar CEJA en X negativo levanta la ceja; por eso la amplitud es negativa"
    }
  },
  "gestos": {
    "saludo": {
      "activo": true,
      "ala": "L",
      "nota": "saluda con el ala al presentarse y al despedirse; R = ala del lado derecho de la pantalla, L = la otra",
      "poses": {
        "arriba": {
          "x": -76,
          "y": -81,
          "z": 110
        },
        "a": {
          "x": -76,
          "y": -81,
          "z": 110
        },
        "b": {
          "x": -125,
          "y": -71,
          "z": 110
        },
        "plumas": {
          "abanico": 9,
          "ondeo": 9
        },
        "ciclos": 3,
        "velocidad": 1.5
      }
    }
  }
};
