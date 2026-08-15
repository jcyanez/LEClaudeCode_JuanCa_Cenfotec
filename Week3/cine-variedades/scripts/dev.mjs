/**
 * Levanta el sistema entero con un solo comando: `npm run dev`.
 *
 * El proyecto son dos paquetes —el servidor con el dominio y el cliente PWA— y
 * hasta ahora había que abrir dos terminales. Esto arranca los dos y mezcla su
 * salida con un prefijo, para poder revisarlo sin acordarse del orden.
 *
 * **Sin dependencias nuevas**: solo `child_process` de Node. Traer un paquete
 * como `concurrently` para esto sería atar el proyecto a un tercero por veinte
 * líneas, justo lo contrario de lo que dice `README.md` sobre dependencias.
 *
 * Si preferís los dos por separado —para leer los registros sin mezclar—, los
 * comandos de siempre siguen estando: `npm run servidor` acá, y `npm run dev`
 * dentro de `entrada-cliente`.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = join(aqui, '..')

const PIEZAS = [
  { nombre: 'servidor', comando: 'npm run servidor', cwd: raiz, color: '[36m' },
  { nombre: 'cliente ', comando: 'npm run dev', cwd: join(raiz, 'entrada-cliente'), color: '[35m' },
]

const RESET = '[0m'
const procesos = []
let cerrando = false

function prefijar(pieza, texto) {
  return texto
    .toString()
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea) => `${pieza.color}[${pieza.nombre}]${RESET} ${linea}`)
    .join('\n')
}

for (const pieza of PIEZAS) {
  // `shell: true` porque en Windows `npm` es un `.cmd` y no un ejecutable.
  const proceso = spawn(pieza.comando, { cwd: pieza.cwd, shell: true })
  proceso.stdout.on('data', (dato) => console.log(prefijar(pieza, dato)))
  proceso.stderr.on('data', (dato) => console.error(prefijar(pieza, dato)))
  proceso.on('exit', (codigo) => {
    if (cerrando) return
    console.error(`${pieza.color}[${pieza.nombre}]${RESET} terminó con código ${codigo}. Se cierra todo.`)
    cerrar(codigo ?? 1)
  })
  procesos.push(proceso)
}

/** Si uno se cae, se bajan los dos: media aplicación corriendo engaña más de lo que sirve. */
function cerrar(codigo) {
  if (cerrando) return
  cerrando = true
  for (const proceso of procesos) proceso.kill()
  process.exit(codigo)
}

process.on('SIGINT', () => cerrar(0))
process.on('SIGTERM', () => cerrar(0))

console.log('Servidor en http://127.0.0.1:3001 · cliente en http://localhost:5173')
console.log('Ctrl+C baja los dos.\n')
