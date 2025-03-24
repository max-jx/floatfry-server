import fetch from "node-fetch"

const result = await fetch("http://localhost:3001/login", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        id: "josephm",
        password: "password123"
    })
})

const body = await result.json()
const token = body.access_token

console.log("login -> accessToken", token)

const e = {
    firstName: "Joe",
    lastName: "Smith",
    email: "joesmith@gmail.com",
    telephone: "07123456789",
    dob: "2004-07-14",
    role: "stamping_machine_operator"
}

const all = await fetch("http://localhost:3001/data/products", {
    method: "GET",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    },
})

//body: JSON.stringify({
//         name: "PannyPanPan",
//         description: "Another pan.",
//         displayPhotos: [],
//         // technicalDrawing: [],
//         designSpec: {materials: ["material-0", "material-1"], supportingDocuments: []},
//         manufacturingInstruction: {
//             machines: ["machine-0", "machine-1"],
//             supportingDocuments: []
//         },
//         colors: [{
//             id: "orange",
//             name: "Orange",
//             color: "#ff7f00"
//         }],
//         lidMaterials: [{
//             id: "plastic",
//             name: "Plastic"
//         }],
//         handleMaterials: [{
//             id: "plastic",
//             name: "Plastic"
//         }],
//         status: "draft"
//     })

// const allUsers = await all.json()
// console.log("all", allUsers)