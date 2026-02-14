<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <title>GLB Texture Mapper</title>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            background-color: #1a1a1a;
            font-family: sans-serif;
        }

        #ui {
            position: absolute;
            top: 15px;
            left: 15px;
            z-index: 100;
            color: white;
            background: rgba(0, 0, 0, 0.8);
            padding: 20px;
            border-radius: 8px;
            width: 320px;
            border: 1px solid #444;
        }

        .info {
            font-size: 0.8em;
            color: #aaa;
            margin-top: 10px;
            line-height: 1.5;
        }

        input[type="file"] {
            margin-top: 10px;
            color: #fff;
        }
    </style>
</head>

<body>
    <div id="ui">
        <strong>GLB & Texture Loader</strong><br>
        <input type="file" id="fileInput" accept=".glb,.png,.jpg,.jpeg" multiple>
        <div class="info">
            本体の .glb と、使用する .png テクスチャを<strong>すべて同時に選択</strong>して開いてください。
        </div>
    </div>

    <script type="importmap">
        {
            "imports": {
                "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
            }
        }
    </script>
    <script type="module" src="js/glb_texture_loader.js"></script>
</body>

</html>