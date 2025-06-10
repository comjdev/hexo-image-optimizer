# hexo-image-optimizer

A Hexo plugin that automatically generates responsive images in multiple sizes and formats (JPG and WebP) using [Sharp](https://github.com/lovell/sharp).

## Features

- Generates 4 responsive sizes for each image:
  - small (480w)
  - medium (768w)
  - large (1280w)
  - xl (1920w)
- Creates both JPG and WebP versions
- Automatically replaces `<img>` tags with responsive `<picture>` elements
- Adds lazy loading
- Preserves original image dimensions
- Configurable quality settings

## Installation

```bash
npm install hexo-image-optimizer --save
```

## Usage

Add configuration to your Hexo `_config.yml` (optional):

```yaml
image_optimizer:
  quality: 80
  jpeg:
    quality: 80
    progressive: true
  webp:
    quality: 80
```

The plugin will automatically:

1. Process all JPG/PNG images in your source and theme directories
2. Generate multiple sizes and formats
3. Replace image tags with responsive picture elements
4. Use WebP for browsers that support it, falling back to JPG

## Example Output

```html
<picture>
	<source
		srcset="
			image-small.webp   480w,
			image-medium.webp  768w,
			image-large.webp  1280w,
			image-xl.webp     1920w
		"
		sizes="(max-width: 600px) 100vw, 
           (max-width: 1200px) 50vw, 
           800px"
		type="image/webp"
	/>
	<source
		srcset="
			image-small.jpg   480w,
			image-medium.jpg  768w,
			image-large.jpg  1280w,
			image-xl.jpg     1920w
		"
		sizes="(max-width: 600px) 100vw, 
           (max-width: 1200px) 50vw, 
           800px"
		type="image/jpeg"
	/>
	<img
		src="image-medium.jpg"
		alt="Description"
		width="800"
		height="600"
		loading="lazy"
	/>
</picture>
```

## License

MIT
