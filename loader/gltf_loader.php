<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <title>glTF Multi-File Loader</title>
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
            width: 300px;
        }

        input[type="file"] {
            margin-top: 10px;
            color: #ccc;
        }

        .info {
            font-size: 0.8em;
            color: #888;
            margin-top: 10px;
            line-height: 1.5;
        }
    </style>
</head>

<body>
    <div id="ui">
        <strong>glTF Standard Loader</strong><br>
        <input type="file" id="fileInput" accept=".gltf,.bin,.glb,image/*" multiple>
        <div class="info">
            ※ .gltf を読み込む場合は、関連する .bin やテクスチャ画像も<strong>すべて同時に選択</strong>して開いてください。
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
    <script type="module" src="../js/loader/gltf_loader.js"></script>
</body>

</html>