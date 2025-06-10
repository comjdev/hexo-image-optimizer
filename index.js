"use strict";

const sharp = require("sharp");
const glob = require("glob");
const path = require("path");
const fs = require("fs").promises;

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
};

async function optimizeImage(filePath, options) {
	try {
		const image = sharp(filePath);
		const metadata = await image.metadata();
		const format = metadata.format;

		if (format === "jpeg" || format === "jpg") {
			await image.jpeg(options.jpeg).toFile(filePath + ".tmp");
		} else if (format === "png") {
			await image.png(options.png).toFile(filePath + ".tmp");
		} else {
			console.log(`Skipping ${filePath} - unsupported format: ${format}`);
			return;
		}

		// Replace original file with optimized version
		await fs.unlink(filePath);
		await fs.rename(filePath + ".tmp", filePath);
		console.log(`Optimized: ${filePath}`);
	} catch (error) {
		console.error(`Error optimizing ${filePath}:`, error);
	}
}

async function findAndOptimizeImages(hexo) {
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

	for (const pattern of patterns) {
		const files = await new Promise((resolve, reject) => {
			glob(pattern, (err, files) => {
				if (err) reject(err);
				else resolve(files);
			});
		});

		for (const file of files) {
			await optimizeImage(file, options);
		}
	}
}

module.exports = function (hexo) {
	if (!hexo || !hexo.extend || !hexo.extend.filter) return;
	hexo.extend.filter.register("before_generate", async function () {
		await findAndOptimizeImages(hexo);
	});
};
