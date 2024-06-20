const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = 'equipo5'; // Debes cambiar esta clave a algo más seguro

// Conexión a MongoDB
mongoose.connect('mongodb://localhost:27017/asistente', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});


const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Conectado a MongoDB');
});

// Definición del modelo de usuario para MongoDB
const userSchema = new mongoose.Schema({
    nombre: String,
    apellido: String,
    email: String,
    password: String,
    edad: Number,
    fechaNacimiento: Date,
    genero: String,
    avatar: String
});

const User = mongoose.model('User', userSchema);

// Cliente de Text-to-Speech
const client = new textToSpeech.TextToSpeechClient({
    keyFilename: './voz.json'
});

// Configurar middleware para CORS
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para sintetizar texto a voz
app.post('/synthesize', async(req, res) => {
    const text = req.body.text;

    const request = {
        input: { text },
        voice: { languageCode: 'es-US', ssmlGender: 'MALE' },
        audioConfig: { audioEncoding: 'MP3', pitch: 15.0, speakingRate: 1.2 },
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        const fileName = `output-${Date.now()}.mp3`;
        const filePath = path.join(__dirname, 'public', 'audio', fileName);
        await fs.promises.writeFile(filePath, response.audioContent, 'binary');
        res.send(`/audio/${fileName}`);
    } catch (error) {
        console.error('ERROR:', error);
        res.status(500).send('Error al sintetizar el discurso');
    }
});

// Ruta para registrar usuario
app.post('/register', async(req, res) => {
    const { nombre, apellido, email, password, edad, fechaNacimiento, genero, avatar } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ nombre, apellido, email, password: hashedPassword, edad, fechaNacimiento, genero, avatar });
        const savedUser = await newUser.save();
        res.status(200).send('Usuario registrado con éxito');
    } catch (err) {
        console.error('Error al guardar el usuario:', err);
        res.status(500).send('Error interno del servidor al guardar el usuario');
    }
});

app.post('/login', async(req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, userId: user._id });
    } catch (err) {
        console.error('Error en el inicio de sesión:', err);
        res.status(500).send('Error interno del servidor al iniciar sesión');
    }
});




// Ruta para obtener un usuario por su ID
app.get('/asistente/users/:id', async(req, res) => {
    const userId = req.params.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            console.log('Usuario no encontrado');
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json(user);
    } catch (err) {
        console.error('Error al obtener el usuario:', err);
        res.status(500).send('Error interno del servidor al obtener el usuario');
    }
});


// Ruta para actualizar un usuario por su ID
app.put('/asistente/users/:id', async(req, res) => {
    const userId = req.params.id;
    const updatedUserData = req.body;

    try {
        const updatedUser = await User.findByIdAndUpdate(userId, updatedUserData, { new: true });
        if (!updatedUser) {
            return res.status(404).send('Usuario no encontrado');
        }
        res.status(200).json(updatedUser); // Enviar código 200 y el usuario actualizado como respuesta
    } catch (err) {
        console.error('Error al actualizar el usuario:', err);
        res.status(500).send('Error interno del servidor al actualizar el usuario');
    }
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});