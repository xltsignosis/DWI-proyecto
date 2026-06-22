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
// Auth middleware
// ---------------------------------------------------------------------------

async function verificarAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const { data: usuarios, error: dbError } = await supabase
        .from('usuarios')
        .select('id, nombre, rol')
        .eq('id', data.user.id);

    if (dbError || !usuarios || usuarios.length === 0) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    req.usuario = usuarios[0];
    next();
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

app.get('/api/nomina/reporte', verificarAuth, async (req, res) => {
    const { rol } = req.usuario;
    if (rol !== 'administrador' && rol !== 'supervisor') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { inicio, fin } = req.query;
    if (!inicio || !fin) {
        return res.status(400).json({ error: 'Se requieren los parámetros inicio y fin' });
    }

    try {
        const { data: registros, error: errReg } = await supabase
            .from('registros_produccion')
            .select('*, usuarios(nombre), lotes(codigo_lote)')
            .gte('fecha_registro', inicio)
            .lte('fecha_registro', fin);

        if (errReg) return res.status(500).json({ error: 'Error al consultar registros' });

        const { data: tarifas, error: errTar } = await supabase
            .from('tarifas_nomina')
            .select('*');

        if (errTar) return res.status(500).json({ error: 'Error al consultar tarifas' });

        const porOperador = {};

        for (const reg of registros || []) {
            const tarifa = (tarifas || []).find(t =>
                t.tipo_pieza === reg.tipo_pieza &&
                reg.fecha_registro >= t.fecha_inicio_vigencia &&
                reg.fecha_registro <= t.fecha_fin_vigencia
            );

            const pago = tarifa ? Number(tarifa.pago_por_pieza) : 0;
            const subtotal = reg.piezas_reportadas * pago;
            const uid = reg.usuario_id;

            if (!porOperador[uid]) {
                porOperador[uid] = {
                    operador_id: uid,
                    nombre: reg.usuarios?.nombre || uid,
                    piezas_totales: 0,
                    monto_total: 0,
                    detalle: []
                };
            }

            porOperador[uid].piezas_totales += reg.piezas_reportadas;
            porOperador[uid].monto_total += subtotal;
            porOperador[uid].detalle.push({
                lote: reg.lotes?.codigo_lote || String(reg.lote_id),
                tipo_pieza: reg.tipo_pieza,
                piezas: reg.piezas_reportadas,
                tarifa: pago,
                subtotal
            });
        }

        res.json(Object.values(porOperador));
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
});

app.get('/api/nomina/historial', verificarAuth, async (req, res) => {
    const { lote_id, usuario_id } = req.query;

    try {
        let query = supabase
            .from('registros_produccion')
            .select('*, usuarios(nombre), lotes(codigo_lote)')
            .order('fecha_registro', { ascending: false });

        if (lote_id) query = query.eq('lote_id', lote_id);
        if (usuario_id) query = query.eq('usuario_id', usuario_id);

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: 'Error al consultar historial' });

        const resultado = (data || []).map(r => ({
            id: r.id,
            codigo_lote: r.lotes?.codigo_lote || String(r.lote_id),
            nombre_operador: r.usuarios?.nombre || r.usuario_id,
            piezas_reportadas: r.piezas_reportadas,
            tipo_pieza: r.tipo_pieza,
            fecha_registro: r.fecha_registro
        }));

        res.json(resultado);
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
});

app.post('/api/nomina/exportar', verificarAuth, async (req, res) => {
    const { rol } = req.usuario;
    if (rol !== 'administrador') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { inicio, fin, formato } = req.body;
    if (!inicio || !fin || !['pdf', 'excel'].includes(formato)) {
        return res.status(400).json({ error: 'Parámetros inválidos. formato debe ser pdf o excel' });
    }

    try {
        const { data: registros } = await supabase
            .from('registros_produccion')
            .select('*, usuarios(nombre), lotes(codigo_lote)')
            .gte('fecha_registro', inicio)
            .lte('fecha_registro', fin);

        const { data: tarifas } = await supabase.from('tarifas_nomina').select('*');

        const filas = (registros || []).map(r => {
            const tarifa = (tarifas || []).find(t =>
                t.tipo_pieza === r.tipo_pieza &&
                r.fecha_registro >= t.fecha_inicio_vigencia &&
                r.fecha_registro <= t.fecha_fin_vigencia
            );
            const pago = tarifa ? Number(tarifa.pago_por_pieza) : 0;
            return {
                operador: r.usuarios?.nombre || r.usuario_id,
                lote: r.lotes?.codigo_lote || String(r.lote_id),
                tipo_pieza: r.tipo_pieza,
                piezas: r.piezas_reportadas,
                tarifa: pago,
                subtotal: r.piezas_reportadas * pago
            };
        });

        if (formato === 'pdf') {
            const doc = new PDFDocument({ margin: 40 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="nomina_${inicio}_${fin}.pdf"`);
            doc.pipe(res);
            doc.fontSize(16).text(`Nómina ${inicio} — ${fin}`, { align: 'center' });
            doc.moveDown();
            for (const f of filas) {
                doc.fontSize(11).text(
                    `${f.operador} | ${f.lote} | ${f.tipo_pieza} | ${f.piezas} pzs × $${f.tarifa} = $${f.subtotal}`
                );
            }
            doc.end();
        } else {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Nómina');
            ws.columns = [
                { header: 'Operador', key: 'operador', width: 24 },
                { header: 'Lote', key: 'lote', width: 16 },
                { header: 'Tipo pieza', key: 'tipo_pieza', width: 14 },
                { header: 'Piezas', key: 'piezas', width: 10 },
                { header: 'Tarifa', key: 'tarifa', width: 10 },
                { header: 'Subtotal', key: 'subtotal', width: 12 }
            ];
            ws.addRows(filas);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="nomina_${inicio}_${fin}.xlsx"`);
            await wb.xlsx.write(res);
            res.end();
        }
    } catch (err) {
        res.status(500).json({ error: 'Error al exportar' });
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
