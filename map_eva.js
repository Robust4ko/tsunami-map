// map_eva.js

/*
 1. コマンドプロンプトで、「E:」を入力
 2. パスの指定「cd "E:\2025年度\app_googlemap\map_simulation"」を入力実行
 3. サーバー開通「python -m http.server 8000」を入力実行
 4. ブラウザで「http://localhost:8000/test2.html」を検索→完了

 5. コマンドプロンプトで、「コントロール＋C」でサーバー停止（コマンドプロンプトを閉じれば停止される？）
*/

// 追加：グローバル変数宣言
let map;
let directionsService;
let directionsRenderer;
let distanceMatrixService;
let startMarker = null;
let destinations = [];

function displayMessage(message) {
    document.getElementById("nearest-destination").textContent = message;
}

function initMap() {
    var center = { lat: 43.00145388805783, lng: 144.4055069444029 };
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 15,
        center: center
    });

    // 津波ポリゴンの読み込み
    map.data.loadGeoJson('./tsunami.geojson');

    // スタイル設定（薄い青色の透過ポリゴン）
    map.data.setStyle({
        fillColor: '#5c9ee7',
        fillOpacity: 0.3,
        strokeColor: '#5c9ee7',
        strokeWeight: 1,
        clickable: false  // ← ここを追加！
    });


    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);

    distanceMatrixService = new google.maps.DistanceMatrixService();

    loadDestinations();

    map.addListener('click', function(event) {
        setStartPoint(event.latLng);
    });
}

function loadDestinations() {
    fetch('./destinations.json')
        .then(response => response.json())
        .then(data => {
            destinations = data;
            console.log("目的地ロード完了:", destinations.length); // ← 追加
            addAllDestinationMarkers();
        })
        .catch(error => displayMessage("JSON読み込みエラー: " + error));
}

function addMarker(position, title) {
    new google.maps.Marker({
        position: new google.maps.LatLng(position.lat, position.lng),
        map: map,
        title: title,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#00FF00",
            fillOpacity: 0.8,
            strokeWeight: 2,
            strokeColor: "#008000"
        }
    });
}

function addAllDestinationMarkers() {
    destinations.forEach(destination => {
        addMarker(destination.location, destination.name);
    });
}

function setStartPoint(location) {
    if (startMarker) startMarker.setMap(null);
    startMarker = new google.maps.Marker({
        position: location,
        map: map,
        title: "スタート地点"
    });
    findClosestPoint(location);
}

function findClosestPoint(origin) {
    function getDistanceInMeters(loc1, loc2) {
        const R = 6371000;
        const toRad = deg => deg * Math.PI / 180;
        const dLat = toRad(loc2.lat - loc1.lat);
        const dLng = toRad(loc2.lng - loc1.lng);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) *
            Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // ここが抜けてた
        return R * c;
    }

    const nearbyDestinations = destinations.filter(dest => {
        const distance = getDistanceInMeters(
            { lat: origin.lat(), lng: origin.lng() },
            { lat: dest.location.lat, lng: dest.location.lng }
        );
        return distance <= 700;
    });

    if (nearbyDestinations.length === 0) {
        displayMessage("700m以内に避難場所がありません。");
        directionsRenderer.setDirections({ routes: [] });
        return;
    }

    const destinationLocations = nearbyDestinations.map(dest => dest.location);

    distanceMatrixService.getDistanceMatrix(
        {
            origins: [origin],
            destinations: destinationLocations,
            travelMode: google.maps.TravelMode.WALKING,
        },
        function(response, status) {
            if (status === google.maps.DistanceMatrixStatus.OK) {
                const distances = response.rows[0].elements;
                let closestIndex = 0;
                let minDistance = distances[0].distance.value;

                for (let i = 1; i < distances.length; i++) {
                    if (distances[i].distance.value < minDistance) {
                        minDistance = distances[i].distance.value;
                        closestIndex = i;
                    }
                }

                const closestDestination = nearbyDestinations[closestIndex];
                displayMessage("最短の避難先: " + closestDestination.name);
                drawRoute(origin, closestDestination.location);
            } else {
                displayMessage("エラー: " + status);
            }
        }
    );
}

function drawRoute(origin, destination) {
    directionsService.route(
        {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.WALKING,
        },
        function(result, status) {
            if (status === google.maps.DirectionsStatus.OK) {
                directionsRenderer.setDirections(result);
            } else {
                displayMessage("経路描画エラー: " + status);
            }
        }
    );
}

window.initMap = initMap;