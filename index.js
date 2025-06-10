"use strict";

const sharp = require("sharp");
const glob = require("glob");
const path = require("path");
const fs = require("fs").promises;

const SIZES = {
	small: 480,
	medium: 768,
	large: 1280,
	xl: 1920,
};

const DEFAULT_OPTIONS = {
	quality: 80,
	jpeg: {
		quality: 80,
		progressive: true,
	},
	png: {
		quality: 80,
		compressionLevel: 9,
	},
	webp: {
		quality: 80,
	},
};

async function generateImageSizes(filePath, options) {
	try {
		const image = sharp(filePath);
		const metadata = await image.metadata();
		const format = metadata.format;
		const baseName = path.basename(filePath, path.extname(filePath));
		const dirName = path.dirname(filePath);
		const generatedFiles = [];

		// Generate JPG versions
		if (format === "jpeg" || format === "jpg" || format === "png") {
			for (const [size, width] of Object.entries(SIZES)) {
				const jpgPath = path.join(dirName, `${baseName}-${size}.jpg`);
				await image.resize(width).jpeg(options.jpeg).toFile(jpgPath);
				generatedFiles.push(jpgPath);

				// Generate WebP version
				const webpPath = path.join(dirName, `${baseName}-${size}.webp`);
				await image.resize(width).webp(options.webp).toFile(webpPath);
				generatedFiles.push(webpPath);
			}
		} else {
			console.log(`Skipping ${filePath} - unsupported format: ${format}`);
			return null;
		}

		return {
			baseName,
			dirName,
			width: metadata.width,
			height: metadata.height,
		};
	} catch (error) {
		console.error(`Error processing ${filePath}:`, error);
		return null;
	}
}

async function findAndProcessImages(hexo) {
	const options = {
		...DEFAULT_OPTIONS,
		...(hexo.config.image_optimizer || {}),
	};

	// Get source and theme directories
	const sourceDir = hexo.source_dir;
	const themeDir = hexo.theme_dir;

	// Find all jpg and png files
	const patterns = [
		path.join(sourceDir, "**/*.{jpg,jpeg,png}"),
		path.join(themeDir, "**/*.{jpg,jpeg,png}"),
	];

	const imageData = new Map();

	for (const pattern of patterns) {
		const files = await new Promise((resolve, reject) => {
			glob(pattern, (err, files) => {
				if (err) reject(err);
				else resolve(files);
			});
		});

		for (const file of files) {
			const result = await generateImageSizes(file, options);
			if (result) {
				imageData.set(file, result);
			}
		}
	}

	// Register a filter to replace image tags with picture elements
	hexo.extend.filter.register("after_render:html", function (str) {
		for (const [originalPath, data] of imageData) {
			const relativePath = path.relative(hexo.base_dir, data.dirName);
			const pictureElement = `
<picture>
  <source 
    srcset="
      ${relativePath}/${data.baseName}-small.webp 480w, 
      ${relativePath}/${data.baseName}-medium.webp 768w, 
      ${relativePath}/${data.baseName}-large.webp 1280w,
      ${relativePath}/${data.baseName}-xl.webp 1920w
    "
    sizes="(max-width: 600px) 100vw, 
           (max-width: 1200px) 50vw, 
           800px"
    type="image/webp"
  >
  <source 
    srcset="
      ${relativePath}/${data.baseName}-small.jpg 480w, 
      ${relativePath}/${data.baseName}-medium.jpg 768w, 
      ${relativePath}/${data.baseName}-large.jpg 1280w,
      ${relativePath}/${data.baseName}-xl.jpg 1920w
    "
    sizes="(max-width: 600px) 100vw, 
           (max-width: 1200px) 50vw, 
           800px"
    type="image/jpeg"
  >
  <img 
    src="${relativePath}/${data.baseName}-medium.jpg" 
    alt="${data.baseName}" 
    width="${data.width}" 
    height="${data.height}" 
    loading="lazy"
  >
</picture>`;

			// Replace img tags with the original image src
			const imgRegex = new RegExp(
				`<img[^>]*src=["']${originalPath}["'][^>]*>`,
				"g",
			);
			str = str.replace(imgRegex, pictureElement);
		}
		return str;
	});
}

module.exports = function (hexo) {
	if (!hexo || !hexo.extend || !hexo.extend.filter) return;
	hexo.extend.filter.register("before_generate", async function () {
		await findAndProcessImages(hexo);
	});
};
