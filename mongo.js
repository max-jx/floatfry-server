//DbEx0sSlD2xiHkNY

import {Int32, MongoClient, ServerApiVersion} from "mongodb"
import dotenv from "dotenv";
import mongoose, {Schema} from "mongoose";

dotenv.config()

const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
export const Client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const CertificationSchema = new Schema({
    machineId: String,
    dateObtained: Date,
})

const EmployeeSchema = new Schema({
    id: String,
    firstName: String,
    lastName: String,
    email: String,
    telephone: String,
    dob: Date,
    dateJoined: Date,
    role: String,
    isActive: Boolean,
    certifications: [CertificationSchema],
    password: String
})

await mongoose.connect(process.env.MONGO_URI).then(
    (value) => {
        console.log("success")
    },
    (err) => {
        console.log(err)
    }
).catch((err) => {
    if (err) console.log(err)
    else console.log("connected")
})
export const Employee = mongoose.model("Employee", EmployeeSchema, "Staff")

export const EmployeeProjection = [
    "-_id", // no _id
    "id", "firstName", "lastName", "email", "telephone",
    "dob", "dateJoined",
    "role", "certifications", "isActive"
]

// const CertificationSchema = new Schema({
//     employeeId: String,
//     machineId: String,
//     dateObtained: Date
// })
//
// export const Certification = mongoose.model("Certification", CertificationSchema, "Certifications")
//
// export const CertificationProjection = ["-_id"]
//
// const RoleSchema = new Schema({
//     id: String,
//     name: String
// })
//
// export const Role = mongoose.model("Role", RoleSchema, "Roles")
//
// export const RoleProjection = ["-_id"]

const FileSchema = new Schema({
    uri: String,
    name: String
})

const ProductMaterialsSchema = new Schema({
    material: String,
    quantity: Number
})

const ProductMachineSchema = new Schema({
    index: Int32,
    machine: String,
    time: Number
})

const DesignSpecSchema = new Schema({
    materials: [ProductMaterialsSchema],
    supportingDocuments: [FileSchema]
})

const ManufacturingInstructionSchema = new Schema({
    machines: [ProductMachineSchema],
    supportingDocuments: [FileSchema]
})

const ProductColorSchema = new Schema({
    id: String,
    name: String,
    color: String,
    materials: [ProductMaterialsSchema],
    machines: [ProductMachineSchema]
})

    const ProductLidMaterialSchema = new Schema({
    id: String,
    name: String,
    materials: [ProductMaterialsSchema],
    machines: [ProductMachineSchema]
})

const ProductHandleMaterialSchema = new Schema({
    id: String,
    name: String,
    materials: [ProductMaterialsSchema],
    machines: [ProductMachineSchema]
})

const ProductSchema = new Schema({
    id: String,
    name: String,
    description: String,
    displayPhotos: [FileSchema],
    dateCreated: Date,
    technicalDrawing: FileSchema,
    designSpec: DesignSpecSchema,
    manufacturingInstruction: ManufacturingInstructionSchema,
    colors: [ProductColorSchema],
    lidMaterials: [ProductLidMaterialSchema],
    handleMaterials: [ProductHandleMaterialSchema],
    status: String
})

export const Product = mongoose.model("Product", ProductSchema, "Products")

export const ProductProjection = ["-_id"]

const MaterialSchema = new Schema({
    id: String,
    name: String,
    availableQuantity: Number,
    quantityUnit: String,
    requiredQuantity: Number,
    suppliers: [String],
})

export const Material = mongoose.model("Material", MaterialSchema, "Materials")
export const MaterialProjection = ["-_id"]

const SupplierSchema = new Schema({
    id: String,
    name: String,
    website: String,
    email: String,
    telephone: String,
    address: String,
})

export const Supplier = mongoose.model("Supplier", SupplierSchema, "Suppliers")

export const SupplierProjection = ["-_id"]

const MachineSchema = new Schema({
    id: String,
    name: String,
    productionCapacity: Number,
    productionCapacityUnit: String,
    productionCycleSpeed: Number,
    productionCycleSpeedUnit: String,
})

export const Machine = mongoose.model("Machine", MachineSchema, "Machines")

export const MachineProjection = ["-_id"]

const FactoryMachineSchema = new Schema({
    id: String,
    name: String,
    machine: String,
})

export const FactoryMachine = mongoose.model("FactoryMachine", FactoryMachineSchema, "FactoryMachines")

export const FactoryMachineProjection = ["-_id"]

const OrderSchema = new Schema({
    id: String,
    supplier: String,
    material: String,
    datePlaced: Date,
    status: String
})

export const Order = mongoose.model("Order", OrderSchema, "Orders")

export const OrderProjection = ["-_id"]

const SaleSchema = new Schema({
    id: String,
    product: String,
    date: Date,
    color: String,
    lidMaterial: String,
    handleMaterial: String,
    status: String
})

export const Sale = mongoose.model("Sale", SaleSchema, "Sales")

export const SalesProjection = ["-_id"]

const JobSchema = new Schema({
    id: String,
    product: String,
    employee: String,
    machine: String,
    time: Date,
    duration: Number,
    date: Date,
    shift: Number,
})

export const Job = mongoose.model("Job", JobSchema, "Jobs")

export const JobProjection = ["-_id"]




// const employee = await Employee.findOne({id: "josephm"}).exec()
// console.log("find", employee)