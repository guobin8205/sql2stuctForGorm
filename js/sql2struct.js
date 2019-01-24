Vue.use(VueLocalStorage);
new Vue({
    el: '#app',
    data() {
        return {
            cache: null,
            sqlContent: '',
            structContent: '',
            activeIndex: '1',
            typeMap: getTypeMap(),
            typeMapStr: '',
            useGorm: true,
            useJson: true,
            useForm: true,
            dialogFormVisible: false
        }
    },
    created() {
        
        var that = this,
            res = this.$localStorage.get("sql2stuctForGorm");
        // 获取缓存数据
        if (!res) { // 不存在缓存数据
            // 初始配置数据
            var data = {
                useGorm: that.useGorm,
                useJson: that.useJson,
                useForm: that.useForm,
                typeMap: that.typeMap
            }
            that.setCache(data)
            for (var k in that.typeMap) {
                that.typeMapStr += k + ': ' + that.typeMap[k] + '\n'
            }
            return
        }
        var obj = JSON.parse(res)
        if (obj.useGorm != undefined) {
            that.useGorm = obj.useGorm
        }
        if (obj.useJson != undefined) {
            that.useJson = obj.useJson
        }
        if (obj.useForm != undefined) {
            that.useForm = obj.useForm
        }
        if (obj.typeMap != undefined) {
            that.typeMap = obj.typeMap
            for (var k in obj.typeMap) {
                that.typeMapStr += k + ': ' + obj.typeMap[k] + '\n'
            }
        }
    },
    watch: {
        sqlContent(val) {
            if (!val) {
                this.structContent = ''
                return
            }
            var res = val.split('\n')
            if (!res) {
                this.structContent = 'invalid sql'
                return
            }
            var tableComment = res[res.length-1].match(/comment=\'(.*)\'/i),
            types = this.typeMap,
            structResult = 'type ',
            pk = [],
            unique = {},
            indexs = {},
            keys = val.match(/((PRIMARY|UNIQUE)\s)?KEY\s([\`|\w|_]+\s)?\((\w|_|\`|,)+\)/g);

            // 开始处理索引相关
            if (keys.length > 0) {
                var tmpFields = [];
                keys.forEach(function(k){
                    tmpFields = k.match(/\`(\w|_)+\`/g);
                    for (var i = 0; i < tmpFields.length; i++) {
                        tmpFields[i] = tmpFields[i].replace(/\`/g, '');
                    }
                    if (k.indexOf("PRIMARY KEY ") == 0 ){
                        pk = tmpFields
                    }

                    if (k.indexOf("UNIQUE KEY") == 0) {
                        for (var ii = 1; ii < tmpFields.length; ii ++) {
                            if (unique[tmpFields[ii]] == undefined) {
                                unique[tmpFields[ii]] = [];
                            } 
                            unique[tmpFields[ii]].push(tmpFields[0])
                        }
                       
                    }

                    if (k.indexOf("KEY") == 0) {
                        for (var ii = 1; ii < tmpFields.length; ii ++) {
                            if (indexs[tmpFields[ii]] == undefined) {
                                indexs[tmpFields[ii]] = [];
                            } 
                            indexs[tmpFields[ii]].push(tmpFields[0])
                        }
                    }
                })
            }
            for (var i = 0, len = res.length; i < len; i++) {
                var field = res[i].match(/\`(.+)\`\s+((tinyint|smallint|int|mediumint|bigint|float|double|decimal|varchar|char|text|mediumtext|longtext|datetime|time|date|enum|set|blob)?([\([\d]+\)])?)?([\w\s\'\.]+(comment\s\'(.*)\'))?/i)
                if (i == 0) { // 第一个字段为数据表名称
                    if (field && field[1] != undefined && field[2] == undefined) {
                        var tbName = titleCase(field[1])
                        if ( tableComment != null && tableComment.length > 0 ) {
                            structResult = '// '+ tbName + ' ' + tableComment[1] + '\n' + structResult;
                        }
                        structResult += tbName + ' struct {'
                        continue
                    } else {
                        return
                    }
                } else { // 数据表字段
                    // alert(field[1] + field[2] + field[3])
                    if (field && field[1] != undefined && field[2] != undefined && field[3] != undefined) {
                        if (types[field[3]] != undefined) {
                            var sourceFieldName = field[1]
                            var fieldName = titleCase(field[1])
                            var fieldType = types[field[3]]
                            var fieldJsonName = field[1].toLowerCase()
                            if (fieldName.toLowerCase() == 'id') {
                                fieldName = 'ID'
                            }
                            if (field[6] != undefined) {
                                structResult += '\n\t// ' + fieldName + ' ' + field[6]
                            }
                            structResult += '\n\t' + fieldName + ' ' + fieldType + ' '
                            structArr = []
                            if (this.useGorm) {
                                var gorm = ["column:"+sourceFieldName, "type:"+field[2]]

                                if (pk.indexOf(field[1]) >= 0) {
                                    gorm.push("primary_key")
                                }

                                if (unique[field[1]] != undefined) {
                                    gorm.push("unique_index:"+unique[field[1]].join(','))
                                }

                                if (indexs[field[1]] != undefined) {
                                    gorm.push("index:"+indexs[field[1]].join(','))
                                }

                                if (res[i].indexOf("NOT NULL") > 0) {
                                    gorm.push("not null")
                                }

                                if (res[i].indexOf("AUTO_INCREMENT") > 0) {
                                    gorm.push("auto_increment")
                                }

                                structArr.push('gorm:"'+gorm.join(';')+'"')
                            }
                            if (this.useJson) {
                                structArr.push('json:"' + fieldJsonName + '"')
                            }
                            if (this.useForm) {
                                structArr.push('form:"' + fieldJsonName + '"')
                            }
                            if (structArr.length > 0) {
                                structResult += '`' + structArr.join(' ') + '`'
                            }
                        } else {
                            continue
                        }
                    } else {
                        continue
                    }
                }
            }
            structResult += '\n}'
            this.structContent = structResult
        },
        typeMapStr(val) {
            var typeArr = val.split('\n')
            var typeMap = {}
            for (var i = 0, len = typeArr.length; i < len; i++) {
                var itemArr = typeArr[i].split(/\:\s+/)
                if (itemArr[0] != undefined && itemArr[1] != undefined) {
                    typeMap[itemArr[0]] = itemArr[1]
                }
            }
            this.typeMap = typeMap
            var data = {
                useGorm: this.useGorm,
                useJson: this.useJson,
                useForm: this.useForm,
                typeMap: this.typeMap
            }
            this.setCache(data)
        },
        useGorm(val) {
            this.useGorm = val
            var data = {
                useGorm: this.useGorm,
                useJson: this.useJson,
                useForm: this.useForm,
                typeMap: this.typeMap
            }
            this.setCache(data)
        },
        useJson(val) {
            this.useJson = val
            var data = {
                useGorm: this.useGorm,
                useJson: this.useJson,
                useForm: this.useForm,
                typeMap: this.typeMap
            }
            this.setCache(data)
        },
        useForm(val) {
            this.useForm = val
            var data = {
                useGorm: this.useGorm,
                useJson: this.useJson,
                useForm: this.useForm,
                typeMap: this.typeMap
            }
            this.setCache(data)
        }
    },
    methods: {
        handleSelect(key, keyPath) {

        },
        setCache(data) {
            this.$localStorage.set('sql2stuctForGorm', JSON.stringify(data))
        }
    }
})

// 首字母大写
function titleCase(str) {

    var array = str.toLowerCase().split("_"),
    upperArr = getUpperChar();
    
    for (var i = 0; i < array.length; i++) {
        if (upperArr.indexOf(array[i]) >= 0) {
            array[i] = array[i].toUpperCase()
        } else {
            array[i] = array[i][0].toUpperCase() + array[i].substring(1, array[i].length);
        }
    }
    var string = array.join("");

    return string;
}

//　需要特别处理的全大写的关键词
function getUpperChar() {
    return ["id", "ip", "api", "uuid"]
}

// 类型映射
function getTypeMap() {
    return {
        'tinyint': 'int',
        'smallint': 'int',
        'int': 'int',
        'mediumint': 'int64',
        'bigint': 'int64',
        'float': 'float64',
        'double': 'float164',
        'decimal': 'float64',
        'char': 'string',
        'varchar': 'string',
        'text': 'string',
        'mediumtext': 'string',
        'longtext': 'string',
        'time': 'time.Time',
        'date': 'time.Time',
        'datetime': 'time.Time',
        'timestramp': 'int64',
        'enum': 'string',
        'set': 'string',
        'blob': 'string'
    }
}