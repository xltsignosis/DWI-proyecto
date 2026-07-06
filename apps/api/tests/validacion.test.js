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

  test('Debe aceptar un registro normal que no excede ni completa el lote', () => {
    const resultado = validarRegistro(50, 20, 100);

    expect(resultado.valido).toBe(true);
    expect(resultado.excede).toBe(false);
    expect(resultado.completo).toBe(false);
    expect(resultado.nuevoAcumulado).toBe(70);
    expect(resultado.disponible).toBe(50);
  });

  test('Debe calcular correctamente las piezas disponibles antes de registrar', () => {
    const resultado = validarRegistro(30, 5, 100);
    expect(resultado.disponible).toBe(70);
  });

  test('Debe marcar como inválido un registro con piezas_nuevas igual a cero', () => {
    const resultado = validarRegistro(50, 0, 100);
    expect(resultado.valido).toBe(false);
  });

  test('Debe marcar como inválido un registro con piezas_nuevas negativo', () => {
    const resultado = validarRegistro(50, -10, 100);
    expect(resultado.valido).toBe(false);
  });

  test('Debe marcar como inválido si piezasAcumuladas es negativo', () => {
    const resultado = validarRegistro(-5, 10, 100);
    expect(resultado.valido).toBe(false);
  });

  test('Debe marcar como inválido si los valores no son numéricos finitos (NaN)', () => {
    const resultado = validarRegistro('abc', 10, 100);
    expect(resultado.valido).toBe(false);
    expect(resultado.excede).toBe(false);
    expect(resultado.completo).toBe(false);
  });

  test('Debe marcar como inválido si piezasNuevas no es numérico', () => {
    const resultado = validarRegistro(50, 'diez', 100);
    expect(resultado.valido).toBe(false);
  });

  test('Debe manejar total_piezas_requeridas igual a cero', () => {
    const resultado = validarRegistro(0, 5, 0);
    // acumuladas(0) + nuevas(5) = 5, que ya excede un total de 0
    expect(resultado.excede).toBe(true);
  });

  test('[hallazgo] acepta piezas_nuevas con decimales sin marcarlo como inválido', () => {
    // La función solo valida `nuevas > 0`, no que sea un entero. Esto permite
    // registrar cantidades como 2.75 piezas, lo cual probablemente no tiene
    // sentido de negocio y debería validarse con Number.isInteger.
    const resultado = validarRegistro(50, 2.75, 100);
    expect(resultado.valido).toBe(true);
    expect(resultado.nuevoAcumulado).toBe(52.75);
  });

  test('excede debe ser false y completo false cuando el total nuevo es menor al requerido', () => {
    const resultado = validarRegistro(10, 10, 100);
    expect(resultado.excede).toBe(false);
    expect(resultado.completo).toBe(false);
  });

});
