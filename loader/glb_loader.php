<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>3D Character & Animation Linker</title>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            background-color: #222;
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
            border: 1px solid #444;
            width: 280px;
        }

        .field {
            margin-bottom: 15px;
        }

        label {
            display: block;
            font-size: 0.9em;
            margin-bottom: 5px;
            color: #aaa;
        }

        input[type="file"] {
            width: 100%;
            color: #fff;
            font-size: 0.8em;
        }

        button {
            width: 100%;
            padding: 10px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }

        button:hover {
            background: #45a049;
        }

        .hint {
            font-size: 0.75em;
            color: #888;
            margin-top: 10px;
            line-height: 1.4;
        }
    </style>
</head>

<body>
    <div id="ui">
        <div class="field">
            <label>1. キャラクター (.glb)</label>
            <input type="file" id="charInput" accept=".glb">
        </div>
        <div class="field">
            <label>2. アニメーション (.glb)</label>
            <input type="file" id="animInput" accept=".glb">
        </div>
        <button id="loadBtn">統合して読み込み</button>
        <div class="hint">
            ※両方のファイルを選択してボタンを押してください。<br>
            ※ボーン名が一致している必要があります。
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
    <script type="module" src="../js/loader.js"></script>
</body>

</html>