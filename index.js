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
	background_images: {
		enabled: true,
		selector: "[data-background-image]",
		class: "responsive-background",
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
			format,
		};
	} catch (error) {
		console.error(`Error processing ${filePath}:`, error);
		return null;
	}
}

function generateImageSetCSS(imageData, relativePath) {
	const { baseName } = imageData;
	return `
	background-image: image-set(
		url("${relativePath}/${baseName}-small.webp") 1x type("image/webp"),
		url("${relativePath}/${baseName}-medium.webp") 2x type("image/webp"),
		url("${relativePath}/${baseName}-large.webp") 3x type("image/webp"),
		url("${relativePath}/${baseName}-small.jpg") 1x type("image/jpeg"),
		url("${relativePath}/${baseName}-medium.jpg") 2x type("image/jpeg"),
		url("${relativePath}/${baseName}-large.jpg") 3x type("image/jpeg")
	);
	/* Fallback for browsers that don't support image-set() */
	background-image: url("${relativePath}/${baseName}-large.jpg");`;
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
	const backgroundImageData = new Map();

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
				// Check if this is a background image
				const isBackground =
					file.includes("background") ||
					file.includes("bg-") ||
					file.includes("hero");

				if (isBackground) {
					backgroundImageData.set(file, result);
				} else {
					imageData.set(file, result);
				}
			}
		}
	}

	// Register a filter to replace image tags with picture elements
	hexo.extend.filter.register("after_render:html", function (str) {
		// Process regular images
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
  />
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
  />
  <img 
    src="${relativePath}/${data.baseName}-medium.jpg" 
    alt="${data.baseName}" 
    width="${data.width}" 
    height="${data.height}" 
    loading="lazy"
  />
</picture>`;

			// Replace img tags with the original image src
			const imgRegex = new RegExp(
				`<img[^>]*src=["']${originalPath}["'][^>]*>`,
				"g",
			);
			str = str.replace(imgRegex, pictureElement);
		}

		// Process background images
		if (options.background_images.enabled) {
			for (const [originalPath, data] of backgroundImageData) {
				const relativePath = path.relative(hexo.base_dir, data.dirName);
				const imageSetCSS = generateImageSetCSS(data, relativePath);

				// Find elements with this background image
				const bgRegex = new RegExp(
					`background-image:\\s*url\\(["']${originalPath}["']\\)`,
					"g",
				);
				str = str.replace(bgRegex, imageSetCSS);
			}
		}

		return str;
	});

	// Add CSS for background images
	if (options.background_images.enabled) {
		hexo.extend.filter.register("after_render:html", function (str) {
			const styleTag = `
<style>
.${options.background_images.class} {
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
}
</style>`;
			return str.replace("</head>", `${styleTag}</head>`);
		});
	}
}

module.exports = function (hexo) {
	if (!hexo || !hexo.extend || !hexo.extend.filter) return;
	hexo.extend.filter.register("before_generate", async function () {
		await findAndProcessImages(hexo);
	});
};
