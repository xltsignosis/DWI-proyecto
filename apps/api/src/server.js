require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const supabase = require('./supabaseClient');
const { validarRegistro } = require('./validaciones');

const app = express();

const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGINS,
    'http://localhost:3000',
    'http://127.0.0.1:3000'
]
    .filter(Boolean)
    .flatMap((origin) => origin.split(','))
    .map((origin) => origin.trim().replace(/\/$/, ''));

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.replace(/\/$/, '');

        if (allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
        }

        return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true
}));
app.use(express.json());



function formatearEstadoLote(lote) {
    const total = Number(lote.total_piezas_requeridas || 0);
    const acumuladas = Number(lote.piezas_acumuladas || 0);
    const porcentaje = total > 0 ? (acumuladas / total) * 100 : 0;

    return {
        id: lote.id,
        codigo_lote: lote.codigo_lote,
        total_piezas_requeridas: total,
        piezas_acumuladas: acumuladas,
        piezas_disponibles: Math.max(total - acumuladas, 0),
        porcentaje,
        limite_cercano: porcentaje > 90,
        estado: lote.estado || lote.estados_lote?.nombre || null,
        fecha_cierre: lote.fecha_cierre || null
    };
}

function getSupabaseErrorMessage(error, fallback) {
    return error?.message || error?.details || fallback;
}

async function actualizarLoteConEstado(loteId, cambios, estado) {
    const cambiosConEstadoTexto = { ...cambios, estado };
    let resultado = await supabase
        .from('lotes')
        .update(cambiosConEstadoTexto)
        .eq('id', loteId)
        .select('*')
        .single();

    if (!resultado.error) return resultado;

    if ('fecha_cierre' in cambios) {
        const { fecha_cierre, ...cambiosSinFechaCierre } = cambios;
        const resultadoSinFechaCierre = await actualizarLoteConEstado(loteId, cambiosSinFechaCierre, estado);
        if (!resultadoSinFechaCierre.error) return resultadoSinFechaCierre;
    }

    const { data: estadoCatalogo, error: errEstado } = await supabase
        .from('estados_lote')
        .select('id')
        .eq('nombre', estado)
        .single();

    if (errEstado || !estadoCatalogo) return resultado;

    return supabase
        .from('lotes')
        .update({ ...cambios, estado_id: estadoCatalogo.id })
        .eq('id', loteId)
        .select('*, estados_lote(nombre)')
        .single();
}

async function crearLoteConEstado(lote) {
    let resultado = await supabase
        .from('lotes')
        .insert([{ ...lote, estado: 'abierto' }])
        .select('*')
        .single();

    if (!resultado.error) return resultado;

    const { data: estadoCatalogo, error: errEstado } = await supabase
        .from('estados_lote')
        .select('id')
        .eq('nombre', 'abierto')
        .single();

    if (errEstado || !estadoCatalogo) return resultado;

    return supabase
        .from('lotes')
        .insert([{ ...lote, estado_id: estadoCatalogo.id }])
        .select('*, estados_lote(nombre)')
        .single();
}

async function consultarLotes() {
    let resultado = await supabase
        .from('lotes')
        .select('*')
        .order('id', { ascending: true });

    if (!resultado.error) return resultado;

    return supabase
        .from('lotes')
        .select('*, estados_lote(nombre)')
        .order('id', { ascending: true });
}

async function consultarLotePorReferencia(referencia) {
    const valor = String(referencia || '').trim();
    const columna = /^\d+$/.test(valor) ? 'id' : 'codigo_lote';

    let resultado = await supabase
        .from('lotes')
        .select('*')
        .eq(columna, valor)
        .single();

    if (!resultado.error) return resultado;

    return supabase
        .from('lotes')
        .select('*, estados_lote(nombre)')
        .eq(columna, valor)
        .single();
}

// ---------------------------------------------------------------------------
// Endpoints — Auth
// ---------------------------------------------------------------------------

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const { data: usuarios, error: dbError } = await supabase
            .from('usuarios')
            .select('id, nombre, rol')
            .eq('email', email.trim());

        if (dbError || !usuarios || usuarios.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ token: authData.session.access_token, usuario: usuarios[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ---------------------------------------------------------------------------
// Endpoints — Lotes
// ---------------------------------------------------------------------------

app.get('/api/lotes/estado', async (req, res) => {
    try {
        const { data: lotes, error } = await consultarLotes();
        if (error) return res.status(500).json({ error: 'Error al consultar lotes' });
        res.json((lotes || []).map(formatearEstadoLote));
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar lotes' });
    }
});

app.get('/api/lotes/estado/:id', async (req, res) => {
    try {
        const { data: lote, error } = await consultarLotePorReferencia(req.params.id);
        if (error || !lote) return res.status(404).json({ error: 'Lote no encontrado' });
        res.json(formatearEstadoLote(lote));
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar el lote' });
    }
});

app.post('/api/lotes', async (req, res) => {
    const { codigo_lote, total_piezas_requeridas } = req.body;
    const total = Number(total_piezas_requeridas);
    const codigo = String(codigo_lote || '').trim();

    if (!codigo) return res.status(400).json({ error: 'El código del lote es obligatorio' });
    if (!Number.isInteger(total) || total <= 0) {
        return res.status(400).json({ error: 'El total de piezas debe ser un entero mayor a cero' });
    }

    try {
        const { data: loteCreado, error } = await crearLoteConEstado({
            codigo_lote: codigo,
            total_piezas_requeridas: total,
            piezas_acumuladas: 0
        });

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un lote con ese código' });
            return res.status(500).json({ error: 'Error al crear el lote' });
        }

        res.status(201).json(formatearEstadoLote(loteCreado));
    } catch (err) {
        res.status(500).json({ error: 'Error al crear el lote' });
    }
});

// ---------------------------------------------------------------------------
// Endpoints — Producción
// ---------------------------------------------------------------------------

app.post('/api/produccion/registrar', async (req, res) => {
    const { lote_id, usuario_id, piezas_nuevas } = req.body;
    const piezasNuevas = Number(piezas_nuevas);

    try {
        if (!usuario_id) {
            return res.status(401).json({ error: 'Sesión inválida: vuelve a iniciar sesión' });
        }

        const { data: lote, error: errLote } = await consultarLotePorReferencia(lote_id);
        if (errLote || !lote) return res.status(404).json({ error: 'Lote no encontrado' });

        if ((lote.estado || '').toLowerCase() === 'cerrado') {
            return res.status(400).json({ error: 'Registro rechazado: el lote ya está cerrado.' });
        }

        const validacion = validarRegistro(
            lote.piezas_acumuladas,
            piezasNuevas,
            lote.total_piezas_requeridas
        );

        if (!validacion.valido) {
            return res.status(400).json({ error: 'Registro rechazado: datos inválidos.' });
        }

        if (!validacion.valido) return res.status(400).json({ error: 'Registro rechazado: datos inválidos.' });
        if (validacion.excede) return res.status(400).json({ error: 'Registro rechazado: Supera el límite.' });

        const { error: errInsert } = await supabase.from('registros_produccion').insert([
            { lote_id: lote.id, usuario_id, piezas_reportadas: piezasNuevas }
        ]);

        if (errInsert) {
            console.error('Error al guardar registro de producción:', errInsert);
            return res.status(500).json({
                error: 'Error al guardar el registro',
                detalle: getSupabaseErrorMessage(errInsert, 'No se pudo insertar en registros_produccion')
            });
        }

        const nuevoAcumulado = validacion.nuevoAcumulado;
        const nuevoEstado = validacion.completo ? 'cerrado' : 'abierto';
        const cambiosLote = { piezas_acumuladas: nuevoAcumulado };
        if (validacion.completo) cambiosLote.fecha_cierre = new Date().toISOString();

        const { data: loteActualizado, error: errUpdate } = await actualizarLoteConEstado(lote.id, cambiosLote, nuevoEstado);

        if (errUpdate) {
            console.error('Error al actualizar lote:', errUpdate);
            return res.status(500).json({
                error: 'Error al actualizar el lote',
                detalle: getSupabaseErrorMessage(errUpdate, 'No se pudo actualizar el lote')
            });
        }

        res.json({
            mensaje: 'Producción registrada',
            estado: nuevoEstado,
            lote: formatearEstadoLote(loteActualizado)
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al procesar el registro' });
    }
});

// ---------------------------------------------------------------------------
// Endpoints — Nómina
// ---------------------------------------------------------------------------

app.get('/api/nomina/reporte', async (req, res) => {
    try {
        const auth = await verificarAuth(req, res, ['administrador', 'supervisor']);
        if (!auth) return;

        const { inicio, fin } = req.query;
        if (!inicio || !fin) {
            return res.status(400).json({ error: 'Parámetros inicio y fin son requeridos' });
        }
        if (isNaN(Date.parse(inicio)) || isNaN(Date.parse(fin))) {
            return res.status(400).json({ error: 'Las fechas deben tener formato válido (YYYY-MM-DD)' });
        }
        if (new Date(inicio) > new Date(fin)) {
            return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha fin' });
        }

        const reporte = await obtenerDatosNomina(inicio, fin);
        res.json(reporte);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Error al calcular el reporte de nómina' });
    }
});

app.get('/api/nomina/historial', async (req, res) => {
    try {
        const auth = await verificarAuth(req, res, ['administrador', 'supervisor']);
        if (!auth) return;

        const { lote_id, usuario_id } = req.query;

        let query = supabase
            .from('registros_produccion')
            .select('id, lote_id, usuario_id, piezas_reportadas, tipo_pieza, fecha_registro, usuarios(nombre), lotes(codigo_lote)')
            .order('fecha_registro', { ascending: false });

        if (lote_id) query = query.eq('lote_id', lote_id);
        if (usuario_id) query = query.eq('usuario_id', usuario_id);

        const { data: registros, error } = await query;

        if (error) return res.status(500).json({ error: 'Error al consultar el historial' });

        res.json((registros || []).map(r => ({
            id: r.id,
            lote_id: r.lote_id,
            codigo_lote: r.lotes?.codigo_lote || String(r.lote_id),
            usuario_id: r.usuario_id,
            nombre_operador: r.usuarios?.nombre || 'Desconocido',
            piezas_reportadas: r.piezas_reportadas,
            tipo_pieza: r.tipo_pieza || 'sin_tipo',
            fecha_registro: r.fecha_registro
        })));
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar el historial' });
    }
});

app.post('/api/nomina/exportar', async (req, res) => {
    try {
        const auth = await verificarAuth(req, res, ['administrador']);
        if (!auth) return;

        const { inicio, fin, formato } = req.body;

        if (!inicio || !fin) {
            return res.status(400).json({ error: 'Parámetros inicio y fin son requeridos' });
        }
        if (formato !== 'pdf' && formato !== 'excel') {
            return res.status(400).json({ error: 'Formato debe ser pdf o excel' });
        }

        const reporte = await obtenerDatosNomina(inicio, fin);

        if (formato === 'pdf') {
            const pdfBuffer = await new Promise((resolve, reject) => {
                const doc = new PDFDocument({ margin: 50 });
                const buffers = [];
                doc.on('data', chunk => buffers.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.on('error', reject);

                doc.fontSize(18).font('Helvetica-Bold').text('Reporte de Nómina — MaquilaControl', { align: 'center' });
                doc.moveDown();
                doc.fontSize(11).font('Helvetica').text(`Periodo: ${inicio} al ${fin}`);
                doc.moveDown();

                reporte.forEach(op => {
                    doc.font('Helvetica-Bold').text(op.nombre, { continued: true });
                    doc.font('Helvetica').text(`   Piezas: ${op.piezas_totales}   Monto: ${formatMXN(op.monto_total)}`);
                    op.detalle.forEach(d => {
                        doc.fontSize(9).text(
                            `  ${d.lote} | ${d.tipo_pieza} | ${d.piezas} pzs × ${formatMXN(d.tarifa)} = ${formatMXN(d.subtotal)}`,
                            { indent: 20 }
                        );
                    });
                    doc.fontSize(11).moveDown(0.5);
                });

                doc.end();
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=nomina_${inicio}_${fin}.pdf`);
            return res.end(pdfBuffer);
        }

        // Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Nómina');

        sheet.columns = [
            { header: 'Operador', key: 'nombre', width: 30 },
            { header: 'Piezas Totales', key: 'piezas_totales', width: 15 },
            { header: 'Monto Total (MXN)', key: 'monto_total', width: 22 },
        ];

        sheet.getRow(1).font = { bold: true };
        reporte.forEach(op => sheet.addRow({
            nombre: op.nombre,
            piezas_totales: op.piezas_totales,
            monto_total: op.monto_total
        }));

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=nomina_${inicio}_${fin}.xlsx`);
        return res.end(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ error: err.message || 'Error al exportar la nómina' });
    }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor de MaquilaControl corriendo en http://localhost:${PORT}`);
    });
}

module.exports = app;
