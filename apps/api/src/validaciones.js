
function validarRegistro(piezasAcumuladas, piezasNuevas, totalRequeridas) {
  const acumuladas = Number(piezasAcumuladas);
  const nuevas = Number(piezasNuevas);
  const total = Number(totalRequeridas);

  if (!Number.isFinite(acumuladas) || !Number.isFinite(nuevas) || !Number.isFinite(total)) {
    return { valido: false, excede: false, completo: false, disponible: 0, nuevoAcumulado: acumuladas };
  }

  const nuevoAcumulado = acumuladas + nuevas;
  const disponible = Math.max(total - acumuladas, 0);
  const excede = nuevoAcumulado > total;
  const completo = nuevoAcumulado === total;
  
  return { valido: nuevas > 0 && total >= 0 && acumuladas >= 0, excede, completo, disponible, nuevoAcumulado };
}

// Exportamos la función para que el test y el servidor puedan usarla y no quede sin usar
module.exports = { validarRegistro };
