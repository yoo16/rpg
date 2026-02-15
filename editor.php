<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <title>Map Editor</title>
    <style>
        body {
            font-family: sans-serif;
            display: flex;
            height: 100vh;
            margin: 0;
        }

        #palette {
            width: 200px;
            background: #f0f0f0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            border-right: 1px solid #ccc;
        }

        #editor-container {
            flex: 1;
            padding: 20px;
            overflow: auto;
            background: #333;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        #grid-canvas {
            display: grid;
            gap: 1px;
            background: #000;
            border: 2px solid #555;
        }

        .tile {
            width: 30px;
            height: 30px;
            cursor: pointer;
            box-sizing: border-box;
        }

        /* Tile Colors */
        .tile-0 {
            background-color: #eee;
        }

        /* Floor */
        .tile-1 {
            background-color: #555;
        }

        /* Wall */
        .tile-2 {
            background-color: #4169E1;
        }

        /* Water */

        .tile:hover {
            opacity: 0.8;
            border: 2px solid white;
        }

        button {
            padding: 10px;
            cursor: pointer;
            font-size: 14px;
        }

        .active-brush {
            border: 3px solid #007bff;
            font-weight: bold;
        }

        h2 {
            margin-top: 0;
        }
    </style>
</head>

<body>

    <div id="palette">
        <h2>Map Editor</h2>
        <div id="tools">
            <button onclick="setBrush(0)" class="brush-btn active-brush" id="btn-0">Floor (0)</button>
            <button onclick="setBrush(1)" class="brush-btn" id="btn-1">Wall (1)</button>
            <button onclick="setBrush(2)" class="brush-btn" id="btn-2">Water (2)</button>
        </div>

        <div style="margin-top: auto;">
            <button onclick="saveMap()" style="width: 100%; background: #28a745; color: white; font-weight: bold;">💾 Save Map</button>
            <div id="status" style="margin-top: 10px; font-size: 12px; color: #666;"></div>
        </div>
    </div>

    <div id="editor-container">
        <div id="grid-canvas"></div>
    </div>

    <script>
        let currentBrush = 1; // Default to Wall
        let mapData = null;
        let isMouseDown = false;

        // Initialize
        window.onload = function() {
            loadEditor();
            document.body.onmousedown = () => isMouseDown = true;
            document.body.onmouseup = () => isMouseDown = false;
            setBrush(1);
        };

        function setBrush(type) {
            currentBrush = type;
            document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active-brush'));
            document.getElementById('btn-' + type).classList.add('active-brush');
        }

        async function loadEditor() {
            try {
                const res = await fetch('api/get_map.php?id=1');
                const json = await res.json();
                if (json.status === 'success') {
                    mapData = json.data.map; // The structure is data.map
                    renderGrid();
                } else {
                    alert('Failed to load map data');
                }
            } catch (e) {
                console.error(e);
                alert('Error loading map');
            }
        }

        function renderGrid() {
            const container = document.getElementById('grid-canvas');
            if (!mapData) return;

            // Set grid columns based on map width
            container.style.gridTemplateColumns = `repeat(${mapData.width}, 30px)`;
            container.innerHTML = '';

            mapData.tiles.forEach((row, z) => {
                row.forEach((tileType, x) => {
                    const div = document.createElement('div');
                    div.className = `tile tile-${tileType}`;
                    div.dataset.x = x;
                    div.dataset.z = z;

                    // Drag painting logic
                    div.onmouseenter = (e) => {
                        if (isMouseDown) updateTile(x, z, div);
                    };
                    div.onmousedown = () => updateTile(x, z, div);

                    container.appendChild(div);
                });
            });
        }

        function updateTile(x, z, element) {
            if (!mapData) return;
            mapData.tiles[z][x] = currentBrush;
            element.className = `tile tile-${currentBrush}`;
        }

        async function saveMap() {
            const status = document.getElementById('status');
            status.textContent = 'Saving...';

            try {
                const res = await fetch('api/save_map.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(mapData)
                });
                const json = await res.json();

                if (json.status === 'success') {
                    status.textContent = 'Saved at ' + new Date().toLocaleTimeString();
                    setTimeout(() => status.textContent = '', 3000);
                } else {
                    status.textContent = 'Error: ' + json.message;
                    alert('Save failed');
                }
            } catch (e) {
                console.error(e);
                status.textContent = 'Network Error';
                alert('Save failed');
            }
        }
    </script>

</body>

</html>