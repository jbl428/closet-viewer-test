import React from "react";

export const errorTemplate = (
    <div>
        <script type='text/javascript' dangerouslySetInnerHTML={{__html: "throw \"err\" "}}>
        </script>
    </div>
);
