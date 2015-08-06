$(function() {


    function initialize() {
        var mapDiv = document.getElementById('map-canvas'),
            map,
            markers = [];


        // Get one metadata point to see if they have coordinates
        var metaJsonUrls = _.map($('a.meta'), function(a) {
            return $(a).attr('href');
        });
        var metaJsonUrl = metaJsonUrls.shift().replace('.html', '.json');

        function mapMetadata(metadata, center) {
            var latitude = metadata.latitude,
                longitude = metadata.longitude,
                latlng;

            latlng = new google.maps.LatLng(
                Number(latitude),
                Number(longitude)
            );

            markers.push(new google.maps.Marker({
                position: latlng,
                map: map,
                title: '{{metadata.id}}'
            }));

            if (center) {
                map.setCenter(latlng);
            }

        }

        $.getJSON(metaJsonUrl, function(data) {
            var fetchers = [];

            if (data.metadata.latitude && data.metadata.longitude) {

                $(mapDiv).removeClass('hidden');
                map = new google.maps.Map(mapDiv, {
                    zoom: 11
                });

                mapMetadata(data.metadata, true);
                _.each(metaJsonUrls, function(htmlUrl) {
                    var jsonUrl = htmlUrl.replace('.html', '.json');
                    fetchers.push(function(callback) {
                        $.getJSON(jsonUrl, function(data) {
                            if (data && data.metadata) {
                                mapMetadata(data.metadata);
                            }
                            callback();
                        });
                    });
                });
                async.parallel(fetchers);

            }
        });

    }
    google.maps.event.addDomListener(window, 'load', initialize);


        //$.get('{{ baseurl }}/static/templates/partials/markerLabel/index.html', function(response) {
        //        markerTemplate = response;
        //
        //        var latitude = {{metadata.latitude}},
        //            longitude = {{metadata.longitude}},
        //    latlng, marker, markerData = {};
        //
        //    latlng = new google.maps.LatLng(
        //        Number(latitude),
        //        Number(longitude)
        //    );
        //
        //    marker = new google.maps.Marker({
        //        position: latlng,
        //        map: map,
        //        animation: google.maps.Animation.DROP,
        //        title: '{{metadata.id}}'
        //    });
        //
        //    map.setCenter(latlng);
        //
        //});
        //
        //}


});