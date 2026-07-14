const fs = require('fs')
const path = require('path')

const publicDir = path.join(__dirname, '../public')
const iconsDir = path.join(publicDir, 'icons')

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// 1x1 transparent PNG base64
const transparentPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const buffer = Buffer.from(transparentPngBase64, 'base64')

const files = [
  'illustration.png', 
  'phone-illustration.png', 
  'verified-illustration.png',
  'condition-header.png',
  'coach-illustration.png',
  'coach-diabetes.png',
  'coach-adaeze.png',
  'coach-pcos.png',
  'coach-pre-diabetes.png',
  'coach-fitness.png'
]

files.forEach((file) => {
  const filePath = path.join(publicDir, file)
  if (fs.existsSync(filePath)) {
    console.log(`[Skip] Already exists: ${filePath}`)
  } else {
    fs.writeFileSync(filePath, buffer)
    console.log(`Created placeholder: ${filePath}`)
  }
})

const iconFiles = [
  'diabetes.png',
  'hypertension.png',
  'pcos.png',
  'pre-diabetes.png',
  'general-fitness.png'
]

iconFiles.forEach((file) => {
  const filePath = path.join(iconsDir, file)
  if (fs.existsSync(filePath)) {
    console.log(`[Skip] Icon already exists: ${filePath}`)
  } else {
    fs.writeFileSync(filePath, buffer)
    console.log(`Created icon placeholder: ${filePath}`)
  }
})
