require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { validarRegistro } = require('./validaciones');

const app = express();
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// 1. Configuración de Supabase
console.log("supabaseUrl:", process.env.SUPABASE_URL);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

// Endpoint de Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        console.log("DEBUG LOGIN:", { email });

        // Validar en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            console.error("FALLO EN AUTH:", authError.message);
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        // Buscar rol en tabla 'usuarios'
        console.log("Buscando usuario en tabla 'usuarios' con email:", email);
        const { data: usuarios, error: dbError } = await supabase
            .from('usuarios')
            .select('id, nombre, rol')
            .eq('email', email.trim()); // Quitamos .single() temporalmente

        if (dbError || !usuarios || usuarios.length === 0) {
            console.error("FALLO EN TABLA USUARIOS:", dbError);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Tomamos el primer elemento del arreglo
        const usuario = usuarios[0];

        res.json({
            token: authData.session.access_token,
            usuario: usuario
        });

    } catch (err) {
        console.error("ERROR INTERNO:", err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Endpoint para dashboard de lotes
app.get('/api/lotes/estado', async (req, res) => {
    try {
        const { data: lotes, error } = await consultarLotes();

        if (error) return res.status(500).json({ error: 'Error al consultar lotes' });
        res.json((lotes || []).map(formatearEstadoLote));
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar lotes' });
    }
});

// Endpoint para estado de lote
app.get('/api/lotes/estado/:id', async (req, res) => {
    try {
        const { data: lote, error } = await consultarLotePorReferencia(req.params.id);

        if (error || !lote) return res.status(404).json({ error: 'Lote no encontrado' });
        res.json(formatearEstadoLote(lote));
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar el lote' });
    }
});

// Endpoint para crear lotes
app.post('/api/lotes', async (req, res) => {
    const { codigo_lote, total_piezas_requeridas } = req.body;
    const total = Number(total_piezas_requeridas);
    const codigo = String(codigo_lote || '').trim();

    if (!codigo) {
        return res.status(400).json({ error: 'El código del lote es obligatorio' });
    }

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
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Ya existe un lote con ese código' });
            }

            return res.status(500).json({ error: 'Error al crear el lote' });
        }

        res.status(201).json(formatearEstadoLote(loteCreado));
    } catch (err) {
        res.status(500).json({ error: 'Error al crear el lote' });
    }
});

// Endpoint para registrar producción
app.post('/api/produccion/registrar', async (req, res) => {
    const { lote_id, usuario_id, piezas_nuevas } = req.body;
    const piezasNuevas = Number(piezas_nuevas);

    try {
        const { data: lote, error: errLote } = await consultarLotePorReferencia(lote_id);

        if (errLote || !lote) return res.status(404).json({ error: 'Lote no encontrado' });

        const validacion = validarRegistro(
            lote.piezas_acumuladas,
            piezasNuevas,
            lote.total_piezas_requeridas
        );

        if (!validacion.valido) {
            return res.status(400).json({ error: 'Registro rechazado: datos inválidos.' });
        }

        if (validacion.excede) {
            return res.status(400).json({ error: 'Registro rechazado: Supera el límite.' });
        }

        const { error: errInsert } = await supabase.from('registros_produccion').insert([
            { lote_id: lote.id, usuario_id, piezas_reportadas: piezasNuevas }
        ]);

        if (errInsert) return res.status(500).json({ error: 'Error al guardar el registro' });

        const nuevoAcumulado = validacion.nuevoAcumulado;
        const nuevoEstado = validacion.completo ? 'cerrado' : 'abierto';
        const cambiosLote = { piezas_acumuladas: nuevoAcumulado };
        if (validacion.completo) cambiosLote.fecha_cierre = new Date().toISOString();

        const { data: loteActualizado, error: errUpdate } = await actualizarLoteConEstado(lote.id, cambiosLote, nuevoEstado);

        if (errUpdate) return res.status(500).json({ error: 'Error al actualizar el lote' });

        res.json({
            mensaje: 'Producción registrada',
            estado: nuevoEstado,
            lote: formatearEstadoLote(loteActualizado)
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al procesar el registro' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de MaquilaControl corriendo en http://localhost:${PORT}`);
});
