import {GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client} from "@aws-sdk/client-s3"
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config()

const ACCESS_KEY = process.env.S3_ACCESS_KEY
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY

const s3Client = new S3Client({
    region: "eu-north-1",
    credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_ACCESS_KEY
    }
})

const bucket = {
    Bucket: "float-fry"
}

export async function upload(file, name) {
    const response = await s3Client.send(new PutObjectCommand({
        Bucket: "float-fry",
        Key: name,
        Body: file
    }))
    console.log("response", response)

    if (response.$metadata.httpStatusCode === 200 || response.$metadata.httpStatusCode === 200) {
        const uri = await getSignedUrl(s3Client, new GetObjectCommand({
            Bucket: "float-fry", // Specify the AWS S3 bucket name
            Key: name, // Specify the file name
        }))

        return {
            status: 201,
            result: uri
        }
    }
    else {
        return {
            status: 500
        }
    }
}

export async function get(id) {
    try {
        // Check if the file is available in the AWS S3 bucket
        const check = await exists(id);

        if (check) {
            // Create a GetObjectCommand to retrieve the file from S3
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: "float-fry", // Specify the AWS S3 bucket name
                Key: id, // Specify the file name
            }));

            const body = response.Body

            const result = await new Promise((resolve) => {
                const parts = []
                body.on("data", (data) => {
                    parts.push(data)
                })
                body.on("error", () => {
                    resolve({
                        status: 500
                    })
                })
                body.on("end", () => {
                    const buffer = Buffer.concat(parts)

                    resolve({
                        status: 200,
                        result: buffer
                    })
                })
            })

            return result
        } else {
            // Return an error message if the file is not available in the bucket
            return {
                status: 404
            };
        }
    } catch (err) {
        return {
            status: 500
        };
    }
}

async function exists(id) {
    try {
        // Check if the object exists
        await s3Client.send(new HeadObjectCommand({
            Bucket: "float-fry",
            Key: id,
        }));

        // If the object exists, return true
        return true;
    } catch (err) {
        if (err.name === 'NotFound') {
            // File not found in AWS bucket, return false
            return false;
        } else {
            // Handle other errors
            return false;
        }
    }
}

const result =await get("test.png")
console.log(result)