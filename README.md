# hexo-image-optimizer

A Hexo plugin that optimizes images (JPG, PNG) in your source and theme folders using [Sharp](https://github.com/lovell/sharp).

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
  png:
    quality: 80
    compressionLevel: 9
```

The plugin will automatically optimize images before site generation.

## License

MIT
