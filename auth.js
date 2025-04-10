import bcrypt from "bcrypt"
import dotenv from "dotenv"
import * as crypto from "crypto";
import jwt from "jsonwebtoken"

dotenv.config()

export function hashPassword(password) {
    const saltRounds = parseInt(process.env.AUTH_SALT_ROUNDS)

    const salt = bcrypt.genSaltSync(saltRounds)
    const hash = bcrypt.hashSync(password, salt)

    return hash
}

export function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash)
}


export function generateJwt(id, role) {
    const token = jwt.sign({id, role}, "secretKey", {expiresIn: "1hr"})

    return token
}

export function verifyJwt(token) {
    try {
        const data = jwt.verify(token, "secretKey")
        console.log("verified")
        const { id, role } = data

        return {
            id, role
        }
    }
    catch {
        console.log("not verified")
        return null
    }
}

export function createAccessToken(id) {
    const key = crypto.randomBytes(512)
    const token = crypto.createHmac("sha512", key)
        .update(id)
        .digest("base64")

    return token
}

export function generateAccessToken(id, role) {
    return generateJwt(id, role)
}

export function verifyAccessToken(token) {
    return verifyJwt(token)
}

export function hasAccess(path, user, query, body) {
    switch (path) {
        case "register":

    }
}

const Permission = {
    VIEW_STAFF: 1,
    VIEW_SELF: 2,
    VIEW_SALES: 4,
    VIEW_TIMETABLE: 8,
    VIEW_OWN_TIMETABLE: 16,
}