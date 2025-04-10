
const s = []

if (s) {
    console.log("s")
}
else {
    console.log("no")
}

const start = new Date("2024-08-07T16:30:00Z")
const end = new Date("2024-08-07T16:34:00Z")

const d = new Date(end - start)

const m = new Date("2024-08-31")
m.setDate(m.getDate() + 1)

console.log(m.toISOString())