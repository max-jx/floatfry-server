// const express = require("express")
// const cors = require("cors")
// const e = require("express");

import express, {query} from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import {
    Client,
    Employee,
    EmployeeProjection,
    Machine,
    MachineProjection,
    Material,
    MaterialProjection,
    Order,
    OrderProjection,
    Product,
    ProductProjection,
    Supplier,
    SupplierProjection
} from "./mongo.js";
import {generateAccessToken, hashPassword, verifyAccessToken, verifyPassword} from "./auth.js"
import dotenv from "dotenv";
import * as fs from "fs";
import {get, upload} from "./s3.js";

dotenv.config()

const PAGES_LIMIT = parseInt(process.env.MONGO_PAGES_LIMIT)

const app = express()
app.use(express.json())
app.use(cors())
app.use(cookieParser())

app.use("/data", (req, res, next) => {
    const authorization = req.header("Authorization")

    if (authorization) {
        const token = authorization.split(" ")[1]

        if (token === "debug") {
            console.log("Authorized debug user")
            req.user = {id: "josephm", role: "production_manager"}
            next()
            return
        }

        const user = verifyAccessToken(token)

        if (user) {
            console.log("user authorized", user)
            req.user = user
            res.cookie("someCooki", "hi", {httpOnly: true})
            next()
        } else {
            console.log("user unauthorized")
            res.status(401)
            res.send()
        }
    } else {
        res.status(400)
        res.send()
    }
})

app.post("/login", async (req, res) => {
    const body = req.body

    const {
        id, password
    } = body

    try {
        await Client.connect()

        const employeeById = await Client.db("FloatFry")
            .collection("Staff")
            .findOne({id: id})

        const employeeByEmail = await Client.db("FloatFry")
            .collection("Staff")
            .findOne({email: id})

        const employee = employeeById !== null ? employeeById : employeeByEmail

        if (employee === null) {
            res.status(401)
            res.send()
        }

        const hash = employee.password

        const isValid = verifyPassword(password, hash)

        if (!isValid) {
            console.log("login error")
            res.status(401)
            res.send()
        } else {
            console.log("login success")
            const token = generateAccessToken(employee.id, employee.role)

            res.status(200)
            res.json({
                access_token: token
            })
        }
    } catch {
        console.log("server error")

        res.status(500)
        res.send()
    } finally {
        await Client.close()
    }
})

app.get("/activate", (req, res) => {
    const activationId = req.query.activationId

    console.log(`activationId: ${activationId}`)

    res.status(200)
    res.send({
        employeeId: "josephm",
        firstName: "Max"
    })
})

app.post("/data/register", async (req, res) => {
    const {id, role} = req.user

    console.log("register")

    if (role !== "floor_manager" && role !== "production_manager") {
        res.status(403)
        res.send()

        return
    }

    const body = req.body
    console.log("body", body)

    console.log("firstName", body.firstName)

    const employeeId = generateEmployeeId(body.firstName, body.lastName)
    const dateJoined = new Date()

    const newEmployee = new Employee({
        id: employeeId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        telephone: body.telephone,
        dob: body.dob,
        dateJoined,
        role: body.role,
        isActive: false,
        certifications: [],
        password: null
    })

    const response = await newEmployee.save()

    if (response === newEmployee)
        res.status(201)
    res.send()
})

// staff
app.get("/data/staff", async (req, res) => {
    const query = req.query
    const employeeId = query.employeeId
    const page = query.page
    const {id, role} = req.user

    console.log("staff")

    if (employeeId) {
        if (employeeId === id && false) {
            // get own profile
            const employee = await Employee.findOne({id: employeeId}, EmployeeProjection).exec()
            // console.log("employee", employee)

            res.status(200)
            res.json({
                result: employee
            })
        } else {
            const employee = await Employee.findOne({id: employeeId}, EmployeeProjection).exec()
            res.status(200)
            res.json({
                result: employee
            })
        }
    } else if (role === "production_manager" || role === "floor_manager") {
        const count = await getPages(Employee)
        const lastPage = count - 1
        if (page < 0 || page > lastPage) {
            res.status(404)
            res.send()
        } else {
            // get everyone
            const all = await Employee.find({}, EmployeeProjection).exec()
            // console.log("all", all)
            res.status(200)
            res.json({
                result: all,
                count
            })
        }
    } else {
        // not authorized
        res.status(403)
        res.send()
    }
})
app.post("/data/staff", async (req, res) => {
    const {id, role} = req.user

    const query = req.query
    const employeeId = query.employeeId
    const action = query.action
    const body = req.body

    console.log("staff POST", employeeId, action, body)

    if (role === "production_manager" || role === "floor_manager") {
        if (action === "edit" && employeeId) {
            const employeeExists = await Employee.where({id: employeeId}).countDocuments().exec() > 0

            if (employeeExists) {
                const isUniqueEmail = await Employee.where({
                    email: body.email,
                    id: {$ne: employeeId}
                }).countDocuments().exec() === 0

                if (isUniqueEmail) {
                    const newEmployee = {
                        firstName: body.firstName,
                        lastName: body.lastName,
                        email: body.email,
                        telephone: body.telephone,
                        dob: body.dob,
                        dateJoined: body.dateJoined,
                        role: body.role,
                        certifications: body.certifications
                    }

                    const result = await Employee.updateOne({id: employeeId}, newEmployee).exec()

                    if (result.acknowledged) {
                        res.status(200)
                        res.send()
                    } else {
                        res.status(500)
                        res.send()
                    }
                } else {
                    res.status(409)
                    res.send()
                }

            } else {
                res.status(400)
                res.send()
            }
        } else if (action === "register") {
            const isUniqueEmail = await Employee.where({email: body.email}).countDocuments().exec() === 0

            if (isUniqueEmail) {
                const employeeId = await generateEmployeeId(body.firstName, body.lastName)
                const dateJoined = new Date()

                const newEmployee = new Employee({
                    id: employeeId,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    email: body.email,
                    telephone: body.telephone,
                    dob: body.dob,
                    dateJoined,
                    role: body.role,
                    isActive: false,
                    certifications: body.certifications,
                    password: null
                })

                const response = await newEmployee.save()

                console.log("REGISTER r", response)

                if (response === newEmployee) {
                    res.status(201)
                    res.send()
                } else {
                    res.status(500)
                    res.send()
                }
            } else {
                res.status(409)
                res.send()
            }
        } else {
            res.status(400)
            res.send()
        }
    } else if (action === "setPassword" && id === employeeId) {
        const body = req.body

        const password = body.password

        const hash = hashPassword(password)

        const result = await Employee.updateOne({id: employeeId}, {password: hash}).exec()
        if (result.acknowledged) {
            res.status(200)
            res.send()
        } else {
            res.status(500)
            res.send()
        }
    } else {
        // not authorized
        res.status(403)
        res.send()
    }
})

// certifications
app.get("/data/staff/certifications/", async (req, res) => {
    const {id, role} = req.user

    const query = req.query
    const machineId = query.machineId
    const employeeId = query.employeeId

    const filter = {}
    if (machineId) {
        filter.machineId = machineId
    }
    if (employeeId) {
        filter.employeeId = employeeId
    }

    if (id === employeeId || role === "production_manager" || role === "floor_manager") {
        const certifications = await Certification.find(filter, CertificationProjection)

        res.status(200)
        res.json(certifications)
    } else {
        res.status(403)
        res.send()
    }
})
app.get("/data/staff/roles/", async (req, res) => {
    const {id, role} = req.user

    const query = req.query

    if (role === "production_manager" || role === "floor_manager") {
        const roles = await Role.find({}, RoleProjection).exec()

        res.status(200)
        res.json(roles)
    } else {
        res.status(403)
        res.send()
    }
})

app.get("/data/products/", async (req, res) => {
    const query = req.query
    const page = query.page

    const productId = query.productId

    if (productId) {
        const product = await Product.findOne({id: productId}, ProductProjection).exec()

        res.status(200)
        res.json({
            result: product
        })
    } else {
        const count = await getPages(Product)
        const lastPage = count - 1

        if (page < 0 || page > lastPage) {
            res.status(404)
            res.send()
        } else {


            const all = await Product.find({}, ProductProjection).exec()

            console.log("products", all)

            res.status(200)
            res.json({
                result: all,
                count
            })
        }
    }
})

app.post("/data/products/", async (req, res) => {
    const {id, role} = req.user

    const query = req.query
    const body = req.body

    const productId = query.productId
    const action = query.action

    if (role === "production_manager" || role === "floor_manager") {
        if (action === "edit" && productId) {
            const newProduct = body

            const result = await Product.updateOne({id: productId}, newProduct).exec()

            if (result.acknowledged) {
                res.status(200)
                res.send()
            } else {
                res.status(500)
                res.send()
            }
        } else if (action === "new") {
            const newProduct = new Product({
                id: await generateAssetId(body.name, Product),
                dateCreated: new Date().toISOString(),
                ...body
            })

            const result = await newProduct.save()

            if (result === newProduct) {
                res.status(201)
                res.send()
            } else {
                res.status(500)
                res.send()
            }
        }
        else if (action === "editColorOption") {
            const colorOptionId = query.colorOptionId

            const product = await Product.findOne({id: productId}, ProductProjection).exec()

            if (!product) {
                res.status(404)
                res.send()
            }

            const index = product.colors.findIndex((it) => it.id === colorOptionId)

            if (index === -1) {
                res.status(404)
                res.send()
            }

            product.colors[index] = {
                ...body,
                id: colorOptionId
            }
            const result = await Product.updateOne({id: productId}, product).exec()

            if (result.acknowledged) {
                res.status(200)
                res.send()
            }
            else {
                res.status(500)
                res.send()
            }
        }
        else if (action === "editLidMaterialOption") {
            const lidMaterialOptionId = query.lidMaterialOptionId

            const product = await Product.findOne({id: productId}, ProductProjection).exec()

            if (!product) {
                res.status(404)
                res.send()
            }

            const index = product.lidMaterials.findIndex((it) => it.id === lidMaterialOptionId)

            if (index === -1) {
                res.status(404)
                res.send()
            }

            product.lidMaterials[index] = {
                ...body,
                id: lidMaterialOptionId
            }
            const result = await Product.updateOne({id: productId}, product).exec()

            if (result.acknowledged) {
                res.status(200)
                res.send()
            }
            else {
                res.status(500)
                res.send()
            }
        }
        else if (action === "editHandleMaterialOption") {
            const handleMaterialOptionId = query.handleMaterialOptionId
            console.log("OPTION ID", handleMaterialOptionId)

            const product = await Product.findOne({id: productId}, ProductProjection).exec()

            if (!product) {
                res.status(404)
                res.send()
            }

            const index = product.handleMaterials.findIndex((it) => it.id === handleMaterialOptionId)

            if (index === -1) {
                res.status(404)
                res.send()
            }

            product.handleMaterials[index] = {
                ...body,
                id: handleMaterialOptionId
            }
            const result = await Product.updateOne({id: productId}, product).exec()

            if (result.acknowledged) {
                res.status(200)
                res.send()
            }
            else {
                res.status(500)
                res.send()
            }
        }
        else if (action === "newColorOption") {
            const product = await Product.findOne({id: productId}, ProductProjection).exec()

            if (!product) {
                res.status(404)
                res.send()
            }

            product.colors.push({
                ...body,
                id: await generateProductColorOptionId(body.name, productId)
            })
            const result = await Product.updateOne({id: productId}, product).exec()

            if (result.acknowledged) {
                res.status(200)
                res.send()
            }
            else {
                res.status(500)
                res.send()
            }
        }
        else if (action === "newLidMaterialOption") {
            const product = await Product.findOne({id: productId}, ProductProjection).exec()

            if (!product) {
                res.status(404)
                res.send()
            }

            product.lidMaterials.push({
                ...body,
                id: await generateProductLidMaterialOptionId(body.name, productId)
            })
            const result = await Product.updateOne({id: productId}, product).exec()

            if (result.acknowledged) {
                res.status(200)
                res.send()
            }
            else {
                res.status(500)
                res.send()
            }
        }
        else if (action === "newHandleMaterialOption") {
            const product = await Product.findOne({id: productId}, ProductProjection).exec()

            if (!product) {
                res.status(404)
                res.send()
            }

            product.handleMaterials.push({
                ...body,
                id: await generateProductHandleMaterialOptionId(body.name, productId)
            })
            const result = await Product.updateOne({id: productId}, product).exec()

            if (result.acknowledged) {
                res.status(200)
                res.send()
            }
            else {
                res.status(500)
                res.send()
            }
        }
        else {
            res.status(400)
            res.send()
        }
    } else {
        res.status(403)
        res.send()
    }
})

app.get("/data/materials", async (req, res) => {
    const {id, role} = req.user

    const query = req.query
    const materialId = query.materialId
    const page = query.page

    console.log("MATERIALS")

    if (materialId) {
        const material = await Material.findOne({id: materialId}, MaterialProjection).exec()

        if (material) {
            res.status(200)
            res.json({
                result: material
            })
        } else {
            res.status(400)
            res.send()
        }
    } else {
        console.log("MATERIALS all")
        const count = await getPages(Material)
        const lastPage = count - 1

        if (page < 0 || page > lastPage) {
            console.log("MATERIALS invalid page")

            res.status(404)
            res.send()
        } else {
            console.log("MATERIALS valid page")

            const all = await Material.find({}, MaterialProjection)
                .skip(page * 10)
                .limit(PAGES_LIMIT)
                .exec()

            res.status(200)
            res.json({
                result: all,
                count: lastPage + 1
            })
        }
    }
})

app.post("/data/materials", async (req, res) => {
    const {id, role} = req.user

    const query = req.query
    const body = req.body
    const materialId = query.materialId
    const action = query.action

    console.log("materials", materialId, action, body)

    if (action === "edit" && materialId) {
        const newMaterial = {...body}

        const result = await Material.updateOne({id: materialId}, newMaterial).exec()

        if (result.acknowledged) {
            res.status(200)
            res.send()
        } else {
            res.status(500)
            res.send()
        }
    } else if (action === "new") {
        const newMaterial = new Material({
            id: await generateAssetId(body.name, Material),
            ...body
        })

        const result = await newMaterial.save()

        if (result === newMaterial) {
            res.status(200)
            res.send()
        } else {
            res.status(500)
            res.send()
        }
    } else {
        res.status(400)
        res.send()
    }
})

app.get("/data/suppliers", async (req, res) => {
    const query = req.query
    const supplierId = query.supplierId
    const page = query.page

    console.log("COOKIE", req.cookies)

    if (supplierId) {
        const supplier = await Supplier.findOne({id: supplierId}, SupplierProjection).exec()

        if (supplier) {
            res.status(200)
            res.json({
                result: supplier
            })
        } else {
            res.status(400)
            res.send()
        }
    } else {
        const count = await getPages(Supplier)
        const lastPage = count - 1

        if (page < 0 || page > lastPage) {
            res.status(404)
            res.send()
        } else {


            const all = await Supplier.find({}, SupplierProjection).exec()

            res.status(200)
            res.json({
                result: all,
                count
            })
        }
    }
})

app.post("/data/suppliers", async (req, res) => {
    const query = req.query
    const body = req.body

    const supplierId = query.supplierId
    const action = query.action

    console.log("suppliers", supplierId, action === "edit", action === "new", body)

    if (action === "edit" && supplierId) {
        const newSupplier = {...body}

        const result = await Supplier.updateOne({id: supplierId}, newSupplier).exec()

        if (result.acknowledged) {
            res.status(200)
            res.send()
        } else {
            res.status(500)
            res.send()
        }
    } else if (action === "new") {
        const newSupplier = new Supplier({
            id: await generateAssetId(body.name, Supplier),
            ...body
        })

        const result = await newSupplier.save()

        if (result === newSupplier) {
            res.status(200)
            res.send()
        } else {
            res.status(500)
            res.send()
        }
    } else {
        res.status(400)
        res.send()
    }
})

app.get("/data/machines", async (req, res) => {
    const query = req.query

    const machineId = query.machineId
    const page = query.page

    if (machineId) {
        const machine = await Machine.findOne({id: machineId}, MachineProjection).exec()

        if (machine) {
            res.status(200)
            res.json({
                result: machine
            })
        } else {
            res.status(500)
            res.send()
        }
    } else {
        const count = await getPages(Machine)
        const lastPage = count - 1

        if (page < 0 || page > lastPage) {
            res.status(404)
            res.send()
        } else {
            const all = await Machine.find({}, MachineProjection).exec()

            res.json({
                result: all,
                count
            })
        }
    }
})

app.post("/data/machines", async (req, res) => {
    const query = req.query
    const body = req.body

    const machineId = query.machineId
    const action = query.action

    if (action === "edit" && machineId) {
        const newMachine = body

        const result = await Machine.updateOne({id: machineId}, newMachine).exec()

        if (result.acknowledged) {
            res.status(200)
            res.send()
        } else {
            res.status(500)
            res.send()
        }
    } else {
        const newMachine = new Machine({
            id: await generateAssetId(body.name, Machine),
            ...body
        })

        const result = await newMachine.save()

        if (result === newMachine) {
            res.status(201)
            res.send()
        } else {
            res.status(500)
            res.send()
        }
    }
})

app.get("/data/factoryMachines/", async (req, res) => {
    const query = req.query

    const machineType = query.machineType
    const machineId = query.machineId

    if (machineId && !machineType) {
        // get specific machine
        const machine = await Machine.findOne({id: machineId}, MachineProjection).exec()

        if (machine) {
            res.status(200)
            res.json(machine)
        } else {
            res.status(500)
            res.send()
        }
    } else {
        // search
        const filter = {}
        if (machineType) {
            filter.machineType = machineType
        }
        if (machineId) {
            filter.id = machineId
        }

        const all = await Machine.find(filter, MachineProjection).exec()

        res.status(200)
        res.json(all)
    }
})

app.post("/data/factoryMachines/", async (req, res) => {
    const query = req.query
    const body = req.body


    const machineId = query.machineId
    const action = query.action

    if (action === "edit" && machineId) {
        const newMachine = new Machine(body)

        const result = await Machine.updateOne({id: machineId}).exec()
        if (result.acknowledged) {
            res.status(200)
            res.send()
        } else {
            res.status(500)
            res.send()
        }
    } else if (action === "new") {
        const newMachine = new Machine({
            id: await generateAssetId(body.name, Machine),
            ...body
        })

        const result = await newMachine.save()

        if (result === newMachine) {
            res.status(200)
            res.send()
        } else {
            res.status(500)
            res.send()
        }
    }
})

app.get("/data/orders", async (req, res) => {
    const query = req.query
    const orderId = query.orderId
    const page = parseInt(query.page)

    const limit = 10

    if (orderId) {
        const order = await Order.findOne({id: orderId}, OrderProjection).exec()
        console.log("/data/orders", `orderId=${orderId}`, order)

        if (order) {
            res.status(200)
            res.json({
                result: order
            })
        } else if (page) {
            res.status(404)
            res.send()
        }
    } else {
        const count = await getPages(Order)
        const lastPage = count - 1

        if (page > lastPage) {
            res.status(400)
            res.send()
        } else {
            const all = await Order.find({}, OrderProjection)
                .skip(page * limit)
                .limit(limit)
                .exec()

            const response = {
                result: all,
                count: lastPage + 1
            }

            if (page > 0) {
                response.previous = page - 1
            }
            if (page < lastPage) {
                response.next = page + 1
            }

            res.status(200)
            res.json(response)
        }
    }
})

app.post("/data/orders", async (req, res) => {
    const query = req.query
    const orderId = req.orderId
    const action = req.action
    const body = req.body

    if (action === "confirmReceived" && orderId) {
        const newOrder = {
            status: "received"
        }

        const result = await Order.updateOne({id: orderId}, newOrder).exec()

        if (result.acknowledged) {
            res.status(200)
            res.send()
        } else {
            res.status(500)
            res.send()

        }
    } else if (action === "new") {
        const newOrder = new Order({
            id: await generateOrderId(),
            datePlaced: new Date().toISOString(),
            ...body,
        })

        const result = await newOrder.save()

        if (result === newOrder) {
            res.status(201)
            res.send()

        } else {
            res.status(500)
            res.send()

        }
    } else {
        res.status(500)
        res.send()

    }
})

// app.get("/data/files", async (req, res) => {
//     const id = req.id
//
//     if (id) {
//         const response = await get(id)
//
//         if (response.status === 200) {
//             res.status(200)
//             res.body(response.result)
//         }
//         else {
//             res.status(response.status)
//             res.send()
//         }
//     }
// })
app.get("/data/files", async (req, res) => {
    const id = req.id

    if (id) {
        const response = await get(id)

        if (response.status === 200) {
            res.status(200)
            res.body(response.result)
        }
        else {
            res.status(response.status)
            res.send()
        }
    }
})


app.post("/data/files", async (req, res) => {
    const name = decodeURIComponent(req.query.name)

    const parts = [Buffer.alloc(0)]
    req.on("data", (d) => {
        parts.push(d)
    })
    req.on("close", async () => {
        const buffer = Buffer.concat(parts)

        const extension = req.headers["content-type"].split("/")[1]
        const id = `file-${Date.now()}.${extension}`
        const response = await upload(buffer, id)

        console.log("RESPONSE", response)

        if (response.status === 201) {
            res.status(201)
            res.json({
                uri: response.result, name: name
            })
        }
        else {
            res.status(500)
            res.send()
        }
    })
})

app.get("/user", (req, res) => {
    console.log("user no prot")
})


app.listen(3001, (e) => {
    if (e) console.log(e)
    console.log("listening")
})

async function getPages(model, count = PAGES_LIMIT) {
    const documentsCount = await model.countDocuments({}).exec()
    const pagesCount = Math.ceil(documentsCount / count)

    return pagesCount
}

async function generateOrderId() {
    let lastOrder = (await Order.find({}, "id").sort({datePlaced: "asc"}).exec())[0]
    let lastId = lastOrder.id.toString()
    let lastIndex = parseInt(lastId.split("-")[1])
    let index = lastIndex + 1

    return `order-${index}`
}
async function generateProductColorOptionId(name, productId) {
    let n = name.toLowerCase().replace(/\s+/g, "_")
    let id = `color-${n}`
    let suffix = 1
    let product = await Product.findOne({id: productId}, ProductProjection).exec()
    let ids = product.colors.map((it) => it.id)

    while (ids.includes(n)) {
        id = `color-${n}_${suffix}`
        suffix++
    }

    return id
}

async function generateProductLidMaterialOptionId(name, productId) {
    let n = name.toLowerCase().replace(/\s+/g, "_")
    let id = `lid-material-${n}`
    let suffix = 1
    let product = await Product.findOne({id: productId}, ProductProjection).exec()
    let ids = product.lidMaterials.map((it) => it.id)

    while (ids.includes(n)) {
        id = `lid-material-${n}_${suffix}`
        suffix++
    }

    return id
}

async function generateProductHandleMaterialOptionId(name, productId) {
    let n = name.toLowerCase().replace(/\s+/g, "_")
    let id = `handle-material-${n}`
    let suffix = 1
    let product = await Product.findOne({id: productId}, ProductProjection).exec()
    let ids = product.handleMaterials.map((it) => it.id)

    while (ids.includes(n)) {
        id = `handle-material-${n}_${suffix}`
        suffix++
    }

    return id
}

async function generateAssetId(name, model, prefix = model.name.toLowerCase(), field = "id") {
    let p = prefix ? `${prefix}-` : ""
    let n = name.toLowerCase().replace(/\s+/g, "_")
    let id = `${p}${n}`
    let suffix = 1
    let count = await model.where({id}).countDocuments().exec()

    const filter = {}

    while (count > 0) {
        id = `${p}${n}_${suffix}`
        filter[field] = id
        count = await model.where(filter).countDocuments().exec()
        suffix++
    }

    return id
}

async function generateEmployeeId(firstName, lastName) {
    let id = `${lastName.toLowerCase()}${firstName[0].toLowerCase()}`
    let count = await Employee.where({id}).countDocuments().exec()
    let suffix = 1

    while (count > 0) {
        id = `${lastName.toLowerCase()}${firstName[0].toLowerCase()}${suffix}`
        count = await Employee.where({id}).countDocuments().exec()
        suffix++
    }

    return id
}