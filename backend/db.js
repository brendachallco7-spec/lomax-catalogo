const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function probarConexion() {
    try {
        const connection = await pool.getConnection();
        console.log("Conexión a RDS MySQL: OK");
        connection.release();
    } catch (error) {
        console.error("Error conectando a RDS MySQL:", error.message);
    }
}

module.exports = {
    pool,
    probarConexion
};