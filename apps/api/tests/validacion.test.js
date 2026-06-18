
// archivo imporytado de las validaciones
const { validarRegistro } = require('../src/validaciones');

describe('Pruebas unitarias de validación de piezas', () => {
  
  test('Debe detectar y rechazar si el operador reporta más de lo disponible (excede)', () => {
    
    const resultado = validarRegistro(90, 15, 100);
    
    expect(resultado.excede).toBe(true);
    expect(resultado.completo).toBe(false);
  });

  test('Debe detectar cuando el lote se llena exactamente al límite (completo)', () => {
    
    const resultado = validarRegistro(90, 10, 100);
    
    expect(resultado.excede).toBe(false);
    expect(resultado.completo).toBe(true);
  });

});