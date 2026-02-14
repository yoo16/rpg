<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>3D Model Universal Loader (GLB/FBX)</title>
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
            border: 1px solid #444;
        }

        .field {
            margin-bottom: 15px;
        }

        label {
            display: block;
            font-size: 0.9em;
            margin-bottom: 8px;
            color: #aaa;
        }

        input[type="file"] {
            width: 100%;
            color: #fff;
            font-size: 0.8em;
        }

        .hint {
            font-size: 0.75em;
            color: #888;
            margin-top: 10px;
            line-height: 1.4;
        }

        strong {
            color: #4CAF50;
        }
    </style>
</head>

<body>
    <div id="ui">
        <strong>Universal 3D Loader</strong><br>
        <div class="hint">GLB / GLTF / FBX に対応しています</div>
        <hr style="border: 0; border-top: 1px solid #444; margin: 15px 0;">

        <div class="field">
            <label>モデルファイルを選択:</label>
            <input type="file" id="fileInput" accept=".glb,.gltf,.fbx,.bin,image/*" multiple>
        </div>

        <div class="hint">
            ※ .gltf の場合は関連ファイルを一括選択してください。<br>
            ※ FBXのサイズが合わない場合は自動調整を試みます。
        </div>
    </div>

    <script type="importmap">
        {
            "imports": {
                "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
                "fflate": "https://unpkg.com/fflate@0.8.0/browser.js"
            }
        }
    </script>

    <script type="module" src="js/fbx_loader.js"></script>
</body>

</html>