import mysql from "mysql"
import dotenv from "dotenv"

dotenv.config()

const connection = mysql.createConnection({
    host: process.env.HOST,
    port: process.env.PORT,
    user: "admin",
    password: process.env.KEY,
    database: process.env.DB
})

connection.connect((err) => {
    if (err) console.log(err)
    else {
        connection.query("CREATE TABLE staff(id VARCHAR(255), firstName VARCHAR(255), lastName VARCHAR(255), )")
    }
})

