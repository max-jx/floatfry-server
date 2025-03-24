import fetch from "node-fetch";

const result = await fetch("http://localhost:3001/user", {
    method: "GET",
})

// const authorization = result.headers.get("Authorization")
// console.log("auth", authorization)